import type { MediaParseResult, ParsedImage } from '@/types/media-parser'
import {
  ClipboardPaste,
  Download,
  FolderArchive,
  Image as ImageIcon,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import FloatingAlert from '@/components/FloatingAlert/FloatingAlert'
import { Button } from '@/components/motion/button/base'
import { StatefulButton } from '@/components/motion/button/stateful'
import { Input } from '@/components/motion/input'
import { Loader } from '@/components/motion/loader'
import { ImageViewer, ImageViewerContent, ImageViewerThumbnail, type LightboxImage } from '@/components/motion/morphing-lightbox'
import PageHeading from '@/components/PageHeading/PageHeading'
import {
  downloadMedia,
  fetchAuthenticatedBlob,
  parseMedia,
} from '@/lib/media-parser'

export default function MediaParserApp() {
  const [inputText, setInputText] = useState('')
  const [isParsing, setIsParsing] = useState(false)
  const [parseError, setParseError] = useState<string | null>(null)
  const [result, setResult] = useState<MediaParseResult | null>(null)
  const [isZipping, setIsZipping] = useState(false)
  const [previewImages, setPreviewImages] = useState<LightboxImage[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  const handlePaste = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText()
      if (text) {
        setInputText(text.trim())
        inputRef.current?.focus()
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
    if (isParsing) return
    if (!trimmed) {
      setParseError('请输入小红书或抖音链接或分享文本')
      return
    }

    setPreviewImages([])
    setIsParsing(true)
    setParseError(null)
    try {
      const res = await parseMedia(trimmed)
      setPreviewImages([])
      setResult(res)
    }
    catch (err) {
      setParseError(err instanceof Error ? err.message : '解析失败，请检查链接后重试')
    }
    finally {
      setIsParsing(false)
    }
  }, [inputText, isParsing])

  const handlePreviewReady = useCallback((image: LightboxImage) => {
    setPreviewImages(previous => [...previous.filter(item => item.id !== image.id), image]
      .sort((a, b) => Number(a.id) - Number(b.id)))
  }, [])

  const handleDownloadZip = useCallback(async () => {
    if (!result?.zipUrl || isZipping) return
    setIsZipping(true)
    try {
      await downloadMedia(result.zipUrl, result.item.title.trim() || result.item.id)
    }
    catch (err) {
      setParseError(err instanceof Error ? err.message : '打包下载失败')
    }
    finally {
      setIsZipping(false)
    }
  }, [result, isZipping])

  return (
    <div className={`flex w-full flex-1 flex-col items-center pb-[239px] ${result ? 'pt-6 md:pt-10' : 'justify-center'}`}>
      <div className="flex w-full max-w-[840px] flex-col items-center gap-8">
        <PageHeading title="链接解析" description="粘贴小红书或抖音分享内容，下载图片或视频" />

        <form
          className="w-full max-w-xl"
          onSubmit={(event) => {
            event.preventDefault()
            void handleParse()
          }}
        >
          <Input
            ref={inputRef}
            value={inputText}
            onChange={setInputText}
            placeholder="粘贴小红书或抖音链接或分享文本…"
            aria-label="小红书或抖音链接或分享文本"
            readOnly={isParsing}
            rightIcon={(
              <>
                {inputText
                  ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleClear}
                        disabled={isParsing}
                        aria-label="清空输入"
                      >
                        <X className="size-4" />
                      </Button>
                    )
                  : (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => void handlePaste()}
                        aria-label="粘贴剪贴板"
                      >
                        <ClipboardPaste className="size-4" />
                      </Button>
                    )}
                <StatefulButton
                  type="submit"
                  variant="primary"
                  size="sm"
                  state={isParsing ? 'loading' : 'idle'}
                  loadingText="解析中"
                  disabled={!inputText.trim()}
                >
                  解析
                </StatefulButton>
              </>
            )}
          />
        </form>

        <FloatingAlert message={parseError} onDismiss={() => setParseError(null)} />

        {result && !isParsing && (
          <div className="flex w-full flex-col gap-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 flex-col gap-0.5">
                <h3 className="truncate text-base font-semibold text-foreground">
                  {result.item.title || '未命名笔记'}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {result.item.authorName ? `@${result.item.authorName}，` : ''}
                  {result.mediaType === 'video' ? '视频' : `共 ${result.images.length} 张图片`}
                </p>
              </div>

              {result.zipUrl && (
                <StatefulButton
                  variant="primary"
                  size="md"
                  state={isZipping ? 'loading' : 'idle'}
                  loadingText="打包中"
                  icon={<FolderArchive className="size-4" />}
                  onClick={() => void handleDownloadZip()}
                  disabled={result.images.length === 0}
                >
                  下载全部
                </StatefulButton>
              )}
            </div>

            {result.video && <VideoResult key={result.resultId} video={result.video} id={result.item.id} onError={setParseError} />}
            <ImageViewer images={previewImages} label="图片预览">
              <div className="grid grid-cols-2 gap-x-4 gap-y-5 md:grid-cols-3">
                {result.images.map(image => (
                  <ParsedImageCard
                    key={`${result.resultId}-${image.index}`}
                    image={image}
                    note={result.item}
                    previewReady={previewImages.some(item => item.id === String(image.index))}
                    onPreviewReady={handlePreviewReady}
                    onError={setParseError}
                  />
                ))}
              </div>
              <ImageViewerContent />
            </ImageViewer>
          </div>
        )}
      </div>
    </div>
  )
}

function ParsedImageCard({
  image,
  note,
  previewReady,
  onPreviewReady,
  onError,
}: {
  image: ParsedImage
  note: MediaParseResult['item']
  previewReady: boolean
  onPreviewReady: (image: LightboxImage) => void
  onError: (message: string) => void
}) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)

  useEffect(() => {
    let cancelled = false
    let previewUrl: string | undefined
    setIsLoading(true)
    setLoadError(false)

    fetchAuthenticatedBlob(image.previewUrl)
      .then((b) => {
        if (cancelled) return
        previewUrl = URL.createObjectURL(b)
        setObjectUrl(previewUrl)
        setIsLoading(false)
      })
      .catch(() => {
        if (cancelled) return
        setLoadError(true)
        setIsLoading(false)
      })

    return () => {
      cancelled = true
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [image.previewUrl])

  const handleDownload = async () => {
    if (isDownloading) return
    setIsDownloading(true)
    try {
      await downloadMedia(image.downloadUrl, `${note.id}-${String(image.index).padStart(2, '0')}`)
    }
    catch (error) {
      onError(error instanceof Error ? error.message : '下载失败')
    }
    finally {
      setIsDownloading(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="relative aspect-4/5 w-full overflow-hidden rounded-2xl border border-border bg-muted/20">
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
          previewReady
            ? (
                <ImageViewerThumbnail
                  imageId={String(image.index)}
                  aria-label={`查看图片 ${image.index}`}
                  className="size-full"
                  imageClassName="size-full object-cover"
                />
              )
            : (
                <img
                  src={objectUrl}
                  alt={`图片 ${image.index}`}
                  className="size-full object-cover"
                  onLoad={event => onPreviewReady({
                    id: String(image.index),
                    src: objectUrl,
                    alt: `图片 ${image.index}`,
                    width: event.currentTarget.naturalWidth,
                    height: event.currentTarget.naturalHeight,
                  })}
                />
              )
        )}
      </div>

      <div className="flex items-center justify-between pl-2">
        <span className="text-sm tabular-nums text-muted-foreground">
          {String(image.index).padStart(2, '0')}
        </span>
        <StatefulButton
          variant="ghost"
          size="sm"
          state={isDownloading ? 'loading' : 'idle'}
          loadingText="下载中"
          icon={<Download className="size-4" />}
          onClick={handleDownload}
          disabled={isLoading || loadError}
        >
          下载
        </StatefulButton>
      </div>
    </div>
  )
}

function VideoResult({ video, id, onError }: {
  video: NonNullable<MediaParseResult['video']>
  id: string
  onError: (message: string) => void
}) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const previewUrl = useRef<string | null>(null)
  const previewRequest = useRef<AbortController | null>(null)

  useEffect(() => () => {
    previewRequest.current?.abort()
    if (previewUrl.current) URL.revokeObjectURL(previewUrl.current)
  }, [])

  async function preview() {
    if (busy || objectUrl) return
    setBusy(true)
    const controller = new AbortController()
    previewRequest.current = controller
    try {
      const blob = await fetchAuthenticatedBlob(video.previewUrl, controller.signal)
      if (controller.signal.aborted) return
      const url = URL.createObjectURL(blob)
      previewUrl.current = url
      setObjectUrl(url)
    }
    catch (error) {
      if (!controller.signal.aborted) onError(error instanceof Error ? error.message : '预览失败')
    }
    finally { setBusy(false) }
  }

  async function download() {
    if (downloading) return
    setDownloading(true)
    try {
      await downloadMedia(video.downloadUrl, id)
    }
    catch (error) { onError(error instanceof Error ? error.message : '下载失败') }
    finally { setDownloading(false) }
  }

  return (
    <div className="flex flex-col items-center gap-4">
      {objectUrl && <video src={objectUrl} controls preload="metadata" className="max-h-[60vh] w-full rounded-2xl" aria-label="视频预览" />}
      <div className="flex gap-3">
        {!objectUrl && <StatefulButton variant="outline" state={busy ? 'loading' : 'idle'} loadingText="加载中" onClick={() => void preview()}>预览视频</StatefulButton>}
        <StatefulButton variant="primary" state={downloading ? 'loading' : 'idle'} loadingText="下载中" icon={<Download className="size-4" />} onClick={() => void download()}>下载视频</StatefulButton>
      </div>
    </div>
  )
}
