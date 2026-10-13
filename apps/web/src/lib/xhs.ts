import type { XHSParseResult } from '@/types/xhs'
import { apiData, apiFetch } from '@/lib/api'

export async function parseXHSNote(text: string): Promise<XHSParseResult> {
  return await apiData<XHSParseResult>('/api/xhs/parse', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text }),
  })
}

export async function fetchAuthenticatedBlob(path: string): Promise<Blob> {
  const response = await apiFetch(path)
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

export async function downloadXHSImage(downloadUrl: string, filename: string): Promise<void> {
  const blob = await fetchAuthenticatedBlob(downloadUrl)
  triggerDownload(blob, filename)
}

export async function downloadXHSArchive(zipUrl: string, filename: string): Promise<void> {
  const blob = await fetchAuthenticatedBlob(zipUrl)
  triggerDownload(blob, filename)
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result)
      }
      else {
        reject(new Error('转换图片格式失败'))
      }
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}
