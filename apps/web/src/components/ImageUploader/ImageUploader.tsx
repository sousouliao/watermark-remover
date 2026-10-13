import { Image as ImageIcon, UploadCloud, X } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { Input } from '@/components/ui/input'
import { ACCEPTED_TYPES, MAX_SIZE_BYTES, MAX_SIZE_MB } from '@/constants/upload'
import { useIsMobile } from '@/hooks/useIsMobile'
import { SPRING_PRESS } from '@/lib/ease'
import { cn } from '@/lib/utils'

export default function ImageUploader({
  onImageSelect,
}: {
  onImageSelect: (file: File, dataUrl: string) => void
}) {
  const { isMobile } = useIsMobile()
  const reduce = useReducedMotion()
  const [isDragOver, setIsDragOver] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const readerRef = useRef<FileReader | null>(null)

  useEffect(
    () => () => {
      readerRef.current?.abort()
    },
    [],
  )

  function handleFile(file: File) {
    readerRef.current?.abort()
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError('不支持此文件格式，请使用 PNG、JPG 或 WEBP。')
      return
    }
    if (file.size > MAX_SIZE_BYTES) {
      setError(`文件过大，最大支持 ${MAX_SIZE_MB}MB。`)
      return
    }
    setError(null)
    const reader = new FileReader()
    readerRef.current = reader
    reader.onload = () => {
      if (typeof reader.result === 'string') onImageSelect(file, reader.result)
    }
    reader.onerror = () => setError('无法读取图片，请重新选择。')
    reader.readAsDataURL(file)
  }

  return (
    <div className="mx-auto w-full max-w-xl">
      <motion.div
        role="button"
        tabIndex={0}
        aria-label={isMobile ? '点击选择图片' : '拖入图片或点击选择'}
        whileHover={reduce ? undefined : { scale: 1.008 }}
        whileTap={reduce ? undefined : { scale: 0.992 }}
        transition={SPRING_PRESS}
        className={cn(
          'relative flex min-h-72 cursor-pointer flex-col items-center justify-center gap-5 overflow-hidden rounded-2xl border border-dashed p-8 md:min-h-80',
          'bg-card text-card-foreground transition-colors duration-150',
          isDragOver
            ? 'border-foreground bg-secondary/80 ring-1 ring-foreground/20'
            : 'border-border hover:border-foreground/40 hover:bg-secondary/30',
          error && 'border-destructive/60 bg-destructive/5',
        )}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            inputRef.current?.click()
          }
        }}
        onDrop={(event) => {
          event.preventDefault()
          setIsDragOver(false)
          const file = event.dataTransfer.files[0]
          if (file) handleFile(file)
        }}
        onDragOver={(event) => {
          event.preventDefault()
          setIsDragOver(true)
        }}
        onDragLeave={(event) => {
          event.preventDefault()
          setIsDragOver(false)
        }}
      >
        <Input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_TYPES.join(',')}
          className="sr-only"
          aria-hidden="true"
          tabIndex={-1}
          onClick={event => event.stopPropagation()}
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) handleFile(file)
            event.target.value = ''
          }}
        />

        <div className="relative z-10 flex size-12 items-center justify-center rounded-xl border border-border bg-secondary text-foreground transition-transform duration-150">
          {isDragOver
            ? (
                <ImageIcon className="size-5 text-foreground" />
              )
            : (
                <UploadCloud className="size-5 text-foreground" />
              )}
        </div>

        <div className="relative z-10 text-center">
          <p className="text-sm font-medium text-foreground md:text-base">
            {isDragOver ? '松开即可置入图片' : isMobile ? '轻触选择图片' : '拖入图片，或点击浏览'}
          </p>
          <p className="mt-1.5 text-xs text-muted-foreground">
            PNG · JPG · WEBP · 单张最大
            {' '}
            {MAX_SIZE_MB}
            MB
          </p>
        </div>

        {error && (
          <div
            role="alert"
            className="relative z-10 flex items-center gap-2 rounded-md border border-destructive/20 bg-destructive/10 px-3 py-1.5 text-xs text-destructive"
          >
            <X className="size-3.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </motion.div>
    </div>
  )
}
