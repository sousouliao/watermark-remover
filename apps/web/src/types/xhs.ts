export interface XHSImage {
  index: number
  previewUrl: string
  downloadUrl: string
}

export interface XHSNote {
  id: string
  title: string
  description: string
  authorName: string
}

export interface XHSParseResult {
  resultId: string
  note: XHSNote
  images: XHSImage[]
  zipUrl: string
  expiresAt: string
}
