import type { MediaParseResult, MediaPlatform, ParsedItem } from '@/types/media-parser'
import { apiData, apiFetch } from '@/lib/api'

export async function parseMedia(text: string): Promise<MediaParseResult> {
  const urls = text.match(/https?:\/\/[^\s<>"“”]+/g) ?? []
  const platforms = new Set<MediaPlatform>()
  for (const value of urls) {
    try {
      const host = new URL(value).hostname.toLowerCase()
      if (['xiaohongshu.com', 'www.xiaohongshu.com', 'xhslink.com', 'www.xhslink.com'].includes(host)) platforms.add('xhs')
      if (['douyin.com', 'www.douyin.com', 'v.douyin.com', 'www.iesdouyin.com'].includes(host)) platforms.add('douyin')
    }
    catch { /* 后端负责完整链接校验 */ }
  }
  if (platforms.size !== 1) throw new Error('请提供一条小红书或抖音链接')
  const platform = [...platforms][0]
  const result = await apiData<Omit<MediaParseResult, 'item'> & { item?: ParsedItem, note?: ParsedItem }>(`/api/${platform}/parse`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  })
  const item = result.item ?? result.note
  if (!item) throw new Error('解析结果缺少作品信息')
  return { ...result, item }
}

export async function fetchAuthenticatedBlob(path: string, signal?: AbortSignal): Promise<Blob> {
  const response = await apiFetch(path, { signal })
  if (!response.ok) {
    throw new Error(`获取资源失败 (${response.status})`)
  }
  return await response.blob()
}

export function triggerDownload(blob: Blob, filename: string) {
  const objectUrl = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = objectUrl
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000)
}

export async function downloadMedia(downloadUrl: string, basename: string): Promise<void> {
  const blob = await fetchAuthenticatedBlob(downloadUrl)
  const extension = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'video/mp4': 'mp4', 'application/zip': 'zip' }[blob.type]
  if (!extension) throw new Error('下载文件类型无效')
  triggerDownload(blob, `${basename}.${extension}`)
}
