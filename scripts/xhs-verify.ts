import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import { lookup } from 'node:dns/promises'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import http from 'node:http'
import https from 'node:https'
import { BlockList, isIP } from 'node:net'
import { dirname, join, resolve } from 'node:path'
import process from 'node:process'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'

type Kind = 'page' | 'media'
type DnsMode = 'system' | 'cloudflare'
type JsonObject = Record<string, unknown>
export interface HttpResult { url: string, status: number, body: Buffer, contentType: string }
type Fetcher = (url: string, kind: Kind) => Promise<HttpResult>
const SINGLE_ADDRESS = { autoSelectFamily: false }

class ProbeError extends Error {
  code: string
  constructor(code: string, message: string) {
    super(message)
    this.code = code
  }
}

const PRIVATE_V4 = new BlockList()
for (const [address, prefix] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
] as const) PRIVATE_V4.addSubnet(address, prefix, 'ipv4')

export function isPublicAddress(address: string): boolean {
  if (isIP(address) === 4) return !PRIVATE_V4.check(address, 'ipv4')
  // Only global unicast IPv6; exclude mapped/private addresses and special 2001 ranges.
  return isIP(address) === 6 && /^[23][0-9a-f]{3}:/i.test(address)
    && !/^2001:(?:0:|db8:|[12][0-9a-f]:)/i.test(address)
    && !address.startsWith('2002:')
}

export function validateUrl(value: string, kind: Kind): URL {
  let url: URL
  try {
    url = new URL(value)
  }
  catch { throw new ProbeError('invalid-link', '链接格式无效') }
  const host = url.hostname.toLowerCase()
  const allowed = kind === 'page'
    ? ['xhslink.com', 'www.xhslink.com', 'xiaohongshu.com', 'www.xiaohongshu.com'].includes(host)
    : host === 'ci.xiaohongshu.com' || host.endsWith('.xhscdn.com')
  if (!allowed || !['http:', 'https:'].includes(url.protocol) || url.username || url.password
    || (url.port && url.port !== (url.protocol === 'https:' ? '443' : '80'))) {
    throw new ProbeError('blocked-target', '请求目标不在允许范围内')
  }
  url.hash = ''
  return url
}

export function extractUrl(text: string): string {
  for (const match of text.matchAll(/https?:\/\/[^\s<>"“”]+/g)) {
    const value = match[0].replace(/[，。！；、）)\]}]+$/u, '')
    try {
      return validateUrl(value, 'page').href
    }
    catch { /* Ignore unrelated URLs in share text. */ }
  }
  throw new ProbeError('invalid-link', '未找到有效的小红书分享链接')
}

export function redirectTarget(location: string, current: string, kind: Kind): string {
  return validateUrl(new URL(location, current).href, kind).href
}

async function resolveAddresses(hostname: string, mode: DnsMode, signal: AbortSignal) {
  signal.throwIfAborted()
  if (mode === 'system') {
    return new Promise<{ address: string, family: number }[]>((accept, reject) => {
      const abort = () => reject(signal.reason)
      signal.addEventListener('abort', abort, { once: true })
      lookup(hostname, { all: true }).then(accept, reject).finally(() => signal.removeEventListener('abort', abort))
    })
  }
  // Explicit opt-in for local fake-IP DNS; verify TLS and pin the public DoH endpoint.
  const body = await new Promise<string>((accept, reject) => {
    const url = new URL('https://cloudflare-dns.com/dns-query')
    url.searchParams.set('name', hostname)
    url.searchParams.set('type', 'A')
    const req = https.get(url, {
      signal,
      headers: { Accept: 'application/dns-json' },
      ...SINGLE_ADDRESS,
      lookup: (_host, _options, callback) => callback(null, '1.1.1.1', 4),
    }, (res) => {
      if (res.statusCode !== 200) {
        res.destroy()
        reject(new ProbeError('dns-error', '公共 DNS 请求失败'))
        return
      }
      let size = 0
      const chunks: Buffer[] = []
      res.on('data', (chunk: Buffer) => {
        size += chunk.length
        if (size > 16_384) res.destroy(new ProbeError('dns-error', '公共 DNS 响应超过限制'))
        else chunks.push(chunk)
      })
      res.on('error', reject)
      res.on('end', () => accept(Buffer.concat(chunks).toString('utf8')))
    })
    req.on('error', reject)
  })
  const data = object(JSON.parse(body))
  if (data.Status !== 0 || !Array.isArray(data.Answer)) throw new ProbeError('dns-error', '公共 DNS 没有返回有效记录')
  return data.Answer.map(object).filter(item => item.type === 1 && typeof item.data === 'string').map(item => ({ address: String(item.data), family: 4 }))
}

export async function requestChecked(value: string, kind: Kind, dnsMode: DnsMode = 'system'): Promise<HttpResult> {
  let url = validateUrl(value, kind)
  const signal = AbortSignal.timeout(25_000)
  const limit = kind === 'page' ? 4 * 1024 * 1024 : 30 * 1024 * 1024
  for (let hop = 0; hop <= 5; hop++) {
    signal.throwIfAborted()
    const addresses = await resolveAddresses(url.hostname, dnsMode, signal)
    signal.throwIfAborted()
    if (!addresses.length || addresses.some(item => !isPublicAddress(item.address))) {
      throw new ProbeError('blocked-target', '域名解析到了非公网地址')
    }
    const address = addresses.find(item => item.family === 4) ?? addresses[0]
    const transport = url.protocol === 'https:' ? https : http
    const result = await new Promise<HttpResult & { location?: string }>((accept, reject) => {
      const req = transport.get(url, {
        signal,
        ...SINGLE_ADDRESS,
        // Pin the validated DNS result while retaining Host and TLS SNI.
        lookup: (_host, _options, callback) => callback(null, address.address, address.family),
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
          'Accept': kind === 'page' ? 'text/html' : 'image/jpeg,image/png,image/webp,*/*;q=0.5',
          'Accept-Language': 'zh-CN,zh;q=0.9',
          'Accept-Encoding': 'identity',
        },
      }, (res) => {
        const status = res.statusCode ?? 0
        const contentType = String(res.headers['content-type'] ?? '')
        if ([301, 302, 303, 307, 308].includes(status)) {
          res.destroy()
          accept({ url: url.href, status, body: Buffer.alloc(0), contentType, location: res.headers.location })
          return
        }
        if (Number(res.headers['content-length']) > limit) {
          res.destroy()
          reject(new ProbeError('size-limit', '响应超过大小限制'))
          return
        }
        if (res.headers['content-encoding'] && res.headers['content-encoding'] !== 'identity') {
          res.destroy()
          reject(new ProbeError('unsupported-encoding', '服务器未返回请求的 identity 编码'))
          return
        }
        let size = 0
        const chunks: Buffer[] = []
        res.on('data', (chunk: Buffer) => {
          size += chunk.length
          if (size > limit) res.destroy(new ProbeError('size-limit', '响应超过大小限制'))
          else chunks.push(chunk)
        })
        res.on('error', reject)
        res.on('end', () => accept({ url: url.href, status, body: Buffer.concat(chunks), contentType }))
      })
      req.on('error', reject)
    })
    if (![301, 302, 303, 307, 308].includes(result.status)) return result
    if (!result.location) throw new ProbeError('invalid-redirect', '重定向缺少目标地址')
    url = new URL(redirectTarget(result.location, url.href, kind))
  }
  throw new ProbeError('redirect-limit', '重定向次数超过限制')
}

function object(value: unknown): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonObject : {}
}

export function parseInitialState(html: string): JsonObject {
  for (const script of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script\s*>/gi)) {
    const marker = /(?:^|[;\s])window\.__INITIAL_STATE__\s*=\s*/.exec(script[1])
    if (!marker) continue
    const source = script[1].slice(marker.index + marker[0].length)
    if (!source.startsWith('{')) throw new ProbeError('state-format', '状态数据不是 JSON 对象')
    const stack: string[] = []
    let normalized = ''
    // Read only JSON data plus bare undefined values; never execute JavaScript.
    const tokens = /"(?:\\[\s\S]|[^"\\])*"|\bundefined\b|[{}[\]]|[^"{}[\]]/gy
    for (let token = tokens.exec(source); token; token = tokens.exec(source)) {
      const value = token[0]
      normalized += value === 'undefined' ? 'null' : value
      if (value === '{' || value === '[') stack.push(value)
      if (value === '}' || value === ']') {
        if (stack.pop() !== (value === '}' ? '{' : '[')) break
        if (!stack.length) {
          try {
            return object(JSON.parse(normalized))
          }
          catch { throw new ProbeError('state-format', '状态包含非 JSON 数据，未执行页面脚本') }
        }
      }
    }
    throw new ProbeError('state-format', '状态数据不完整')
  }
  throw new ProbeError('state-missing', '页面没有 INITIAL_STATE，需检查访问限制或渲染方式')
}

export function extractNote(state: JsonObject, noteId: string): JsonObject {
  const map = object(object(state.note).noteDetailMap)
  const fallback = object(object(object(state.noteData).data).noteData)
  const note = object(object(map[noteId]).note)
  const selected = Object.keys(note).length ? note : fallback
  if (!Object.keys(selected).length || (selected.noteId && selected.noteId !== noteId)) {
    throw new ProbeError('note-missing', '状态中没有与链接对应的笔记')
  }
  if (selected.type !== 'normal') throw new ProbeError('unsupported-note', '本轮只验证静态图文笔记')
  if (!Array.isArray(selected.imageList) || !selected.imageList.length || selected.imageList.length > 80) {
    throw new ProbeError('invalid-images', '图片列表为空或超出验证限制')
  }
  return selected
}

export function imageSources(image: JsonObject): { preview: string, candidate: string | null } {
  const info = Array.isArray(image.infoList) ? image.infoList.map(object) : []
  const preview = image.urlDefault || image.url || info.find(item => item.imageScene === 'WB_DFT')?.url || image.urlPre
  if (typeof preview !== 'string') throw new ProbeError('image-url-missing', '图片没有可用预览地址')
  const url = validateUrl(preview, 'media')
  // Experimental rule observed in the public downloader; not an official original-file API.
  const match = /^\/\d+\/[a-z0-9]+\/([\w\-/]+)!/i.exec(url.pathname)
  const candidate = /^sns-webpic-[a-z0-9-]+\.xhscdn\.com$/i.test(url.hostname) && match
    ? `https://ci.xiaohongshu.com/${match[1]}?imageView2/format/jpeg`
    : null
  return { preview: url.href, candidate }
}

export function imageMetadata(data: Buffer): { extension: string, width: number, height: number } {
  if (data.length >= 45 && data.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))
    && data.toString('ascii', 12, 16) === 'IHDR' && data.subarray(-12).equals(Buffer.from('0000000049454e44ae426082', 'hex'))) {
    return { extension: 'png', width: data.readUInt32BE(16), height: data.readUInt32BE(20) }
  }
  if (data.length >= 12 && data.readUInt16BE(0) === 0xFFD8 && data.readUInt16BE(data.length - 2) === 0xFFD9) {
    let offset = 2
    while (offset + 4 <= data.length && data[offset] === 0xFF) {
      while (data[offset] === 0xFF) offset++
      const marker = data[offset++]
      if (marker === 0xDA || marker === 0xD9) break
      const length = data.readUInt16BE(offset)
      if (length < 2 || offset + length > data.length) break
      if ([0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7, 0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF].includes(marker) && length >= 8) {
        return { extension: 'jpg', width: data.readUInt16BE(offset + 5), height: data.readUInt16BE(offset + 3) }
      }
      offset += length
    }
  }
  if (data.length >= 30 && data.toString('ascii', 0, 4) === 'RIFF'
    && data.toString('ascii', 8, 12) === 'WEBP' && data.readUInt32LE(4) + 8 === data.length) {
    const chunk = data.toString('ascii', 12, 16)
    if (chunk === 'VP8X') return { extension: 'webp', width: data.readUIntLE(24, 3) + 1, height: data.readUIntLE(27, 3) + 1 }
    if (chunk === 'VP8 ' && data.subarray(23, 26).equals(Buffer.from([0x9D, 0x01, 0x2A]))) {
      return { extension: 'webp', width: data.readUInt16LE(26) & 0x3FFF, height: data.readUInt16LE(28) & 0x3FFF }
    }
    if (chunk === 'VP8L' && data[20] === 0x2F) {
      const bits = data.readUInt32LE(21)
      return { extension: 'webp', width: (bits & 0x3FFF) + 1, height: ((bits >>> 14) & 0x3FFF) + 1 }
    }
  }
  throw new ProbeError('invalid-image', '不是可识别的 PNG/JPEG/WebP，或文件结构不完整')
}

function checkResponse(response: HttpResult): void {
  if (response.status >= 200 && response.status < 300) return
  const code = [401, 403, 429, 461, 471].includes(response.status)
    ? 'access-restricted'
    : [404, 410].includes(response.status) ? 'link-unavailable' : 'http-error'
  throw new ProbeError(code, `HTTP ${response.status}`)
}

function failure(error: unknown): { code: string, message: string } {
  if (error instanceof ProbeError) return { code: error.code, message: error.message }
  if (error instanceof Error && ['TimeoutError', 'AbortError'].includes(error.name)) return { code: 'timeout', message: '请求超时' }
  return { code: 'network-or-io-error', message: '网络或文件操作失败；未记录含链接参数的原始异常' }
}

export async function probeSample(text: string, directory: string, fetcher: Fetcher = requestChecked) {
  let stage = 'link'
  const result: JsonObject = { status: 'failed', stage, manualReview: 'pending', images: [] }
  try {
    const source = extractUrl(text)
    result.sourceUrl = source
    stage = 'page'
    const response = await fetcher(source, 'page')
    result.resolvedUrl = response.url
    result.httpStatus = response.status
    checkResponse(response)
    const url = validateUrl(response.url, 'page')
    if (/login|captcha|verify|website-login/i.test(url.pathname)) throw new ProbeError('access-restricted', '页面跳转到了登录或验证流程')
    const noteId = /^\/(?:explore|discovery\/item)\/([a-f0-9]{24})\/?$/i.exec(url.pathname)?.[1]
    if (!noteId) throw new ProbeError('invalid-link', '最终链接不是支持的笔记详情地址')
    result.noteId = noteId
    stage = 'state'
    const note = extractNote(parseInitialState(response.body.toString('utf8')), noteId)
    result.title = note.title
    result.author = object(note.user).nickname || object(note.user).nickName
    const images = note.imageList as unknown[]
    result.expectedImages = images.length
    const records: JsonObject[] = []
    result.images = records
    await mkdir(directory, { recursive: true })
    stage = 'media'
    for (const [index, raw] of images.entries()) {
      const image = object(raw)
      const record: JsonObject = { index: index + 1, declaredWidth: image.width, declaredHeight: image.height, manualReview: 'pending' }
      records.push(record)
      try {
        const sources = imageSources(image)
        record.sources = sources
        for (const [variant, target] of Object.entries(sources)) {
          if (!target) {
            record[variant] = { status: 'unavailable', code: 'candidate-rule-unmatched' }
            continue
          }
          try {
            const media = await fetcher(target, 'media')
            checkResponse(media)
            const metadata = imageMetadata(media.body)
            if (!metadata.width || !metadata.height) throw new ProbeError('invalid-image', '图片尺寸无效')
            const file = `${String(index + 1).padStart(2, '0')}-${variant}.${metadata.extension}`
            await writeFile(join(directory, file), media.body)
            record[variant] = { status: 'downloaded', file, url: media.url, contentType: media.contentType, bytes: media.body.length, ...metadata, sha256: createHash('sha256').update(media.body).digest('hex'), decodeReview: 'pending' }
          }
          catch (error) { record[variant] = { status: 'failed', ...failure(error) } }
          await delay(200)
        }
      }
      catch (error) { record.error = failure(error) }
    }
    const previews = records.filter(item => object(item.preview).status === 'downloaded').length
    const candidates = records.filter(item => object(item.candidate).status === 'downloaded').length
    result.previewDownloaded = previews
    result.candidateDownloaded = candidates
    result.status = candidates === images.length && previews === images.length ? 'downloaded-awaiting-review' : 'partial'
  }
  catch (error) { result.error = failure(error) }
  result.stage = stage
  return result
}

async function main() {
  const args = process.argv.slice(2)
  if (!args.length || args[0] === '--help') {
    process.stdout.write('用法: node scripts/xhs-verify.ts --input .local/xhs-verification/samples.json [--label local|cloud] [--dns system|cloudflare]\n输入: 1–10 条分享文本组成的 JSON 字符串数组。Node 20 使用 pnpm exec tsx。\n')
    return
  }
  const options: Record<string, string> = {}
  for (let index = 0; index < args.length; index += 2) {
    if (!['--input', '--label', '--dns'].includes(args[index]) || !args[index + 1]) throw new ProbeError('arguments', '参数无效，使用 --help 查看用法')
    options[args[index]] = args[index + 1]
  }
  if (!options['--input']) throw new ProbeError('arguments', '缺少 --input')
  const label = options['--label'] ?? 'local'
  const dnsMode = options['--dns'] ?? 'system'
  if (dnsMode !== 'system' && dnsMode !== 'cloudflare') throw new ProbeError('arguments', 'dns 只能为 system 或 cloudflare')
  if (!/^[a-z0-9-]{1,32}$/i.test(label)) throw new ProbeError('arguments', 'label 只能包含字母、数字和连字符')
  const samples: unknown = JSON.parse(await readFile(resolve(options['--input']), 'utf8'))
  if (!Array.isArray(samples) || !samples.length || samples.length > 10
    || samples.some(item => typeof item !== 'string' || !item.trim() || item.length > 10_000)) {
    throw new ProbeError('input-format', '输入必须是包含 1–10 条分享文本的 JSON 字符串数组')
  }
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
  const run = `${new Date().toISOString().replace(/[:.]/g, '-')}-${label}`
  const directory = join(root, '.local', 'xhs-verification', run)
  await mkdir(directory, { recursive: true })
  const report: JsonObject = { label, dnsMode, node: process.version, platform: process.platform, startedAt: new Date().toISOString(), conclusion: '需追加验证：下载结果待人工检查', samples: [] }
  const results: JsonObject[] = []
  report.samples = results
  for (const [index, sample] of samples.entries()) {
    const folder = `sample-${String(index + 1).padStart(2, '0')}`
    const result = await probeSample(sample, join(directory, folder), (url, kind) => requestChecked(url, kind, dnsMode))
    results.push({ sample: index + 1, folder, ...result })
    report.summary = {
      total: samples.length,
      attempted: results.length,
      parsed: results.filter(item => typeof item.expectedImages === 'number').length,
      fullyDownloaded: results.filter(item => item.status === 'downloaded-awaiting-review').length,
      qualityAccepted: 0,
    }
    report.conclusion = results.some(item => typeof item.expectedImages === 'number')
      ? '需追加验证：下载结果待人工检查，不代表无水印或原始文件'
      : '需追加验证：本轮尚未取得笔记图片数据，未完成下载链路验收'
    report.finishedAt = new Date().toISOString()
    await writeFile(join(directory, 'report.json'), `${JSON.stringify(report, null, 2)}\n`)
    process.stdout.write(`样本 ${index + 1}/${samples.length}: ${result.status} (${result.stage})\n`)
    if (index + 1 < samples.length) await delay(1000)
  }
  process.stdout.write(`私有报告: ${join(directory, 'report.json')}\n图片解码、数量顺序、尺寸与水印仍需人工验收。\n`)
  if (results.some(item => item.status !== 'downloaded-awaiting-review')) process.exitCode = 1
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    const detail = failure(error)
    process.stderr.write(`${detail.code}: ${detail.message}\n`)
    process.exitCode = 1
  })
}
