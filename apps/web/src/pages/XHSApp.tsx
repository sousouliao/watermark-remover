import type { XHSImage, XHSParseResult } from '@/types/xhs'
import {
  ArrowRight,
  ClipboardPaste,
  Download,
  Eraser,
  FolderArchive,
  Image as ImageIcon,
  Maximize2,
  X,
} from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Alert, AlertClose, AlertContent, AlertDescription, AlertIcon } from '@/components/motion/alert'
import { MotionButton } from '@/components/motion/button'
import { Card, CardContent } from '@/components/motion/card'
import { Loader } from '@/components/motion/loader'
import {
  blobToDataUrl,
  downloadXHSArchive,
  downloadXHSImage,
  fetchAuthenticatedBlob,
  parseXHSNote,
} from '@/lib/xhs'

interface XHSAppProps {
  onImportToWatermark: (dataUrl: string) => void
}

export default function XHSApp({ onImportToWatermark }: XHSAppProps) {
  const [inputText, setInputText] = useState('')
  const [isParsing, setIsParsing] = useState(false)
  const [parseError, setParseError] = useState<string | null>(null)
  const [result, setResult] = useState<XHSParseResult | null>(null)
  const [isZipping, setIsZipping] = useState(false)
  const [previewModalUrl, setPreviewModalUrl] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const handlePaste = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText()
      if (text) {
        setInputText(text.trim())
      }
    }
    catch {
      // 剪贴板受阻时静默忽略
    }
  }, [])

  const handleClear = useCallback(() => {
    setInputText('')
    setParseError(null)
    if (inputRef.current) inputRef.current.focus()
  }, [])

  const handleParse = useCallback(async () => {
    const trimmed = inputText.trim()
    if (!trimmed) {
      setParseError('请输入小红书链接或分享文本')
      return
    }

    setIsParsing(true)
    setParseError(null)
    try {
      const res = await parseXHSNote(trimmed)
      setResult(res)
    }
    catch (err) {
      setParseError(err instanceof Error ? err.message : '解析失败，请检查链接后重试')
    }
    finally {
      setIsParsing(false)
    }
  }, [inputText])

  const handleDownloadZip = useCallback(async () => {
    if (!result || isZipping) return
    setIsZipping(true)
    try {
      const filename = `${result.note.title.trim() || result.note.id || 'xhs'}.zip`
      await downloadXHSArchive(result.zipUrl, filename)
    }
    catch (err) {
      setParseError(err instanceof Error ? err.message : '打包下载失败')
    }
    finally {
      setIsZipping(false)
    }
  }, [result, isZipping])

  return (
    <div className="flex w-full flex-col items-center py-4 md:py-6">
      <div className="flex w-full max-w-[840px] flex-col items-center gap-6">
        {/* Minimal Headline */}
        <div className="flex flex-col items-center gap-1 text-center">
          <h2 className="text-base font-semibold tracking-tight text-foreground">
            小红书解析
          </h2>
        </div>

        {/* Unified Minimal Input Bar */}
        <div className="w-full max-w-xl">
          <div className="flex items-center rounded-2xl border border-border bg-card/70 p-1.5 shadow-sm backdrop-blur-md transition-colors focus-within:border-foreground/40">
            <input
              ref={inputRef}
              type="text"
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  void handleParse()
                }
              }}
              placeholder="粘贴小红书链接或分享文本…"
              disabled={isParsing}
              className="min-w-0 flex-1 bg-transparent px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
            />

            <div className="flex shrink-0 items-center gap-1">
              {inputText
                ? (
                    <button
                      type="button"
                      onClick={handleClear}
                      aria-label="清空输入"
                      className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:text-foreground cursor-pointer"
                    >
                      <X className="size-4" />
                    </button>
                  )
                : (
                    <button
                      type="button"
                      onClick={() => void handlePaste()}
                      aria-label="粘贴剪贴板"
                      title="粘贴"
                      className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:text-foreground cursor-pointer"
                    >
                      <ClipboardPaste className="size-4" />
                    </button>
                  )}

              <MotionButton
                variant="primary"
                size="sm"
                onClick={() => void handleParse()}
                disabled={isParsing || !inputText.trim()}
                className="h-8 gap-1 rounded-xl px-3 text-xs font-medium"
              >
                {isParsing
                  ? (
                      <Loader variant="spinner" size={14} />
                    )
                  : (
                      <>
                        <span>解析</span>
                        <ArrowRight className="size-3.5" />
                      </>
                    )}
              </MotionButton>
            </div>
          </div>
        </div>

        {/* Error Alert */}
        {parseError && (
          <div className="w-full max-w-xl">
            <Alert
              variant="destructive"
              open={!!parseError}
              onOpenChange={open => !open && setParseError(null)}
            >
              <AlertIcon />
              <AlertContent>
                <AlertDescription>{parseError}</AlertDescription>
              </AlertContent>
              <AlertClose />
            </Alert>
          </div>
        )}

        {/* Result Area */}
        {result && !isParsing && (
          <div className="flex w-full flex-col gap-4 pt-2">
            {/* Minimal Header */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/40 pb-3">
              <div className="flex flex-col gap-0.5">
                <h3 className="text-sm font-medium text-foreground">
                  {result.note.title || '未命名笔记'}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {result.note.authorName ? `@${result.note.authorName} · ` : ''}
                  共
                  {' '}
                  {result.images.length}
                  {' '}
                  张图片
                </p>
              </div>

              <MotionButton
                variant="outline"
                size="sm"
                onClick={() => void handleDownloadZip()}
                disabled={isZipping || result.images.length === 0}
                className="h-8 gap-1.5 text-xs font-medium"
              >
                {isZipping
                  ? (
                      <Loader variant="spinner" size={14} />
                    )
                  : (
                      <FolderArchive className="size-3.5" />
                    )}
                <span>下载全部 ZIP</span>
              </MotionButton>
            </div>

            {/* Gallery Grid */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
              {result.images.map(image => (
                <XHSImageCard
                  key={image.index}
                  image={image}
                  note={result.note}
                  onPreview={url => setPreviewModalUrl(url)}
                  onImportToWatermark={onImportToWatermark}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Lightbox Modal */}
      <AnimatePresence>
        {previewModalUrl && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 p-4 backdrop-blur-md"
            onClick={() => setPreviewModalUrl(null)}
          >
            <div className="relative max-h-[90vh] max-w-[90vw]">
              <button
                type="button"
                onClick={() => setPreviewModalUrl(null)}
                aria-label="关闭预览"
                className="absolute -top-10 right-0 rounded-full border border-border bg-card p-1.5 text-foreground hover:bg-muted cursor-pointer"
              >
                <X className="size-4" />
              </button>
              <img
                src={previewModalUrl}
                alt="预览大图"
                className="max-h-[85vh] max-w-[88vw] rounded-xl border border-border object-contain"
                onClick={e => e.stopPropagation()}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function XHSImageCard({
  image,
  note,
  onPreview,
  onImportToWatermark,
}: {
  image: XHSImage
  note: XHSParseResult['note']
  onPreview: (url: string) => void
  onImportToWatermark: (dataUrl: string) => void
}) {
  const [blob, setBlob] = useState<Blob | null>(null)
  const [objectUrl, setObjectUrl] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const [isImporting, setIsImporting] = useState(false)

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    setLoadError(false)

    fetchAuthenticatedBlob(image.previewUrl)
      .then((b) => {
        if (cancelled) return
        setBlob(b)
        const url = URL.createObjectURL(b)
        setObjectUrl(url)
        setIsLoading(false)
      })
      .catch(() => {
        if (cancelled) return
        setLoadError(true)
        setIsLoading(false)
      })

    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [image.previewUrl])

  const handleDownload = async () => {
    if (isDownloading) return
    setIsDownloading(true)
    try {
      const filename = `${note.id}-${String(image.index).padStart(2, '0')}.jpg`
      await downloadXHSImage(image.downloadUrl, filename)
    }
    finally {
      setIsDownloading(false)
    }
  }

  const handleImport = async () => {
    if (!blob || isImporting) return
    setIsImporting(true)
    try {
      const dataUrl = await blobToDataUrl(blob)
      onImportToWatermark(dataUrl)
    }
    finally {
      setIsImporting(false)
    }
  }

  return (
    <Card variant="outlined" className="group overflow-hidden rounded-xl p-0">
      <CardContent className="flex flex-col p-0">
        {/* Thumbnail */}
        <div className="relative aspect-4/5 w-full overflow-hidden bg-muted/20">
          {isLoading && (
            <div className="flex size-full items-center justify-center">
              <Loader variant="spinner" size={16} />
            </div>
          )}

          {loadError && (
            <div className="flex size-full flex-col items-center justify-center gap-1 p-3 text-muted-foreground">
              <ImageIcon className="size-5 opacity-40" />
              <span className="text-xs">加载失败</span>
            </div>
          )}

          {objectUrl && !isLoading && (
            <img
              src={objectUrl}
              alt={`图片 ${image.index}`}
              className="size-full object-cover transition-transform duration-200 group-hover:scale-102"
            />
          )}

          {/* Index Tag */}
          <div className="absolute left-2 top-2 rounded-md border border-border/60 bg-background/80 px-1.5 py-0.5 text-[11px] font-mono text-muted-foreground backdrop-blur-md">
            #
            {String(image.index).padStart(2, '0')}
          </div>

          {/* Lightbox Trigger */}
          {objectUrl && (
            <button
              type="button"
              onClick={() => onPreview(objectUrl)}
              aria-label="查看大图"
              className="absolute right-2 top-2 flex size-6 items-center justify-center rounded-md border border-border/60 bg-background/80 text-foreground opacity-0 backdrop-blur-md transition-opacity group-hover:opacity-100 hover:bg-background cursor-pointer"
            >
              <Maximize2 className="size-3" />
            </button>
          )}
        </div>

        {/* Minimal Actions Bar */}
        <div className="flex items-center justify-end gap-1.5 border-t border-border/40 bg-card/40 p-2">
          <MotionButton
            variant="ghost"
            size="sm"
            onClick={handleDownload}
            disabled={isDownloading || isLoading}
            className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
          >
            {isDownloading
              ? (
                  <Loader variant="spinner" size={12} />
                )
              : (
                  <Download className="size-3" />
                )}
            <span>下载</span>
          </MotionButton>

          <MotionButton
            variant="outline"
            size="sm"
            onClick={() => void handleImport()}
            disabled={isImporting || !blob || isLoading}
            className="h-7 gap-1 px-2.5 text-xs font-medium"
          >
            {isImporting
              ? (
                  <Loader variant="spinner" size={12} />
                )
              : (
                  <Eraser className="size-3" />
                )}
            <span>去水印</span>
          </MotionButton>
        </div>
      </CardContent>
    </Card>
  )
}
