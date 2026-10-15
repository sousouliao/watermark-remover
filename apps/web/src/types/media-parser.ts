export type MediaPlatform = 'xhs' | 'douyin'

export interface ParsedImage {
  index: number
  previewUrl: string
  downloadUrl: string
}

export interface ParsedItem {
  id: string
  title: string
  description: string
  authorName: string
}

export interface MediaParseResult {
  resultId: string
  item: ParsedItem
  mediaType: 'images' | 'video'
  images: ParsedImage[]
  video?: { previewUrl: string, downloadUrl: string }
  zipUrl?: string
  expiresAt: string
}
