// Use the built-in runner for this standalone probe; no new test dependency.
/* eslint-disable test/no-import-node-test */
import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { extractNote, extractUrl, imageMetadata, imageSources, isPublicAddress, parseInitialState, probeSample, redirectTarget, validateUrl } from './xhs-verify.ts'

const id = '6ac63041000000000d00976e'
const pageUrl = `https://www.xiaohongshu.com/discovery/item/${id}?xsec_token=test-token`
const previewUrl = 'http://sns-webpic-qc.xhscdn.com/20261008/abcdef/notes_pre_post/asset!webp'
// Valid 1x1 PNG; tests only inspect structure, visual decoding remains a real-sample check.
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a3ioAAAAASUVORK5CYII=', 'base64')

function page(images: unknown[] = [{ urlDefault: previewUrl }]) {
  return `<script>window.__INITIAL_STATE__=${JSON.stringify({ note: { noteDetailMap: { [id]: { note: { noteId: id, type: 'normal', imageList: images } } } } })}</script>`
}

test('分享文本选取小红书 URL，保留 token 和 query，支持不同短链路径', () => {
  assert.equal(extractUrl(`其他 https://example.com/  分享 ${pageUrl}。`), pageUrl)
  for (const path of ['/a/abc', '/m/abc', '/o/abc']) assert.equal(extractUrl(`分享 http://xhslink.com${path}）`), `http://xhslink.com${path}`)
  assert.throws(() => extractUrl('没有链接'))
})

test('每次重定向校验目标，拒绝伪造域名、私网、凭据及异常端口', () => {
  assert.equal(redirectTarget(`/explore/${id}?xsec_token=test`, pageUrl, 'page'), `https://www.xiaohongshu.com/explore/${id}?xsec_token=test`)
  for (const target of ['http://127.0.0.1', 'http://169.254.169.254', 'https://xiaohongshu.com.evil.test/', 'https://user@www.xiaohongshu.com/', 'https://www.xiaohongshu.com:8443/']) {
    assert.throws(() => redirectTarget(target, pageUrl, 'page'))
  }
  assert.throws(() => validateUrl('https://www.xiaohongshu.com/explore/abc', 'media'))
  for (const ip of ['127.0.0.1', '10.0.0.1', '100.64.0.1', '169.254.169.254', '::1', '::ffff:127.0.0.1', 'fc00::1', '2001:db8::1']) assert.equal(isPublicAddress(ip), false)
  assert.equal(isPublicAddress('1.1.1.1'), true)
  assert.equal(isPublicAddress('2606:4700:4700::1111'), true)
})

test('安全读取两种状态路径；undefined 仅在字符串外转换，不执行表达式', () => {
  const state = parseInitialState('<script>window.__INITIAL_STATE__={"text":"undefined } \\\"", "missing":undefined};alert(1)</script>')
  assert.equal(state.missing, null)
  assert.equal(state.text, 'undefined } "')
  assert.equal(extractNote(parseInitialState(page()), id).noteId, id)
  const fallback = parseInitialState(`<script>window.__INITIAL_STATE__={"noteData":{"data":{"noteData":{"noteId":"${id}","type":"normal","imageList":[{}]}}}}</script>`)
  assert.equal(extractNote(fallback, id).noteId, id)
  assert.throws(() => extractNote(fallback, '000000000000000000000000'))
  assert.throws(() => parseInitialState('<script>window.__INITIAL_STATE__={"x":(()=>{throw 1})()}</script>'))
  assert.throws(() => parseInitialState('<script>window.__INITIAL_STATE__={"x":1</script>'))
})

test('候选规则匹配与不匹配分开记录，文件格式由内容决定', () => {
  assert.equal(imageSources({ urlDefault: previewUrl }).candidate, 'https://ci.xiaohongshu.com/notes_pre_post/asset?imageView2/format/jpeg')
  assert.equal(imageSources({ urlDefault: 'https://sns-img-qc.xhscdn.com/asset' }).candidate, null)
  assert.deepEqual(imageMetadata(png), { extension: 'png', width: 1, height: 1 })
  assert.throws(() => imageMetadata(Buffer.from('<html>login</html>')))
  assert.throws(() => imageMetadata(png.subarray(0, -10)))
})

test('图集按顺序下载，保存实际格式，HTTP 成功仍需人工质量检查', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'xhs-test-'))
  const calls: string[] = []
  try {
    const result = await probeSample(pageUrl, directory, async (url, kind) => {
      calls.push(url)
      return { url, status: 200, contentType: kind === 'page' ? 'text/html' : 'image/jpeg', body: kind === 'page' ? Buffer.from(page([{ urlDefault: previewUrl }, { urlDefault: previewUrl }])) : png }
    })
    assert.equal(result.status, 'downloaded-awaiting-review')
    assert.equal(result.manualReview, 'pending')
    assert.equal(result.candidateDownloaded, 2)
    assert.equal(calls.length, 5)
    assert.deepEqual(await readFile(join(directory, '02-candidate.png')), png)
  }
  finally { await rm(directory, { recursive: true, force: true }) }
})

test('候选失败不冒充无水印成功，图集其他图片仍继续处理', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'xhs-test-'))
  try {
    const result = await probeSample(pageUrl, directory, async (url, kind) => ({
      url,
      status: url.includes('ci.xiaohongshu.com') ? 403 : 200,
      contentType: kind === 'page' ? 'text/html' : 'image/png',
      body: kind === 'page' ? Buffer.from(page()) : png,
    }))
    assert.equal(result.status, 'partial')
    assert.equal(result.previewDownloaded, 1)
    assert.equal(result.candidateDownloaded, 0)
    const images = result.images as Record<string, unknown>[]
    assert.equal((images[0].candidate as Record<string, unknown>).code, 'access-restricted')
  }
  finally { await rm(directory, { recursive: true, force: true }) }
})

test('页面失败记录阶段和类别，不回显含分享 token 的原始异常', async () => {
  const result = await probeSample(pageUrl, 'unused', async () => {
    throw new Error(pageUrl)
  })
  assert.equal(result.stage, 'page')
  assert.equal(result.status, 'failed')
  assert.equal(JSON.stringify(result.error).includes('test-token'), false)
  const blocked = await probeSample(pageUrl, 'unused', async () => ({ url: pageUrl, status: 461, contentType: 'text/html', body: Buffer.alloc(0) }))
  assert.equal((blocked.error as Record<string, unknown>).code, 'access-restricted')
})
