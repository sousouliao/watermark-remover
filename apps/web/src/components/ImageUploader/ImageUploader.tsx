import { useEffect, useRef, useState } from 'react'
import { Image as ImageIcon, Upload, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { ACCEPTED_TYPES, MAX_SIZE_BYTES, MAX_SIZE_MB } from '@/constants/upload'
import { useIsMobile } from '@/hooks/useIsMobile'
import { cn } from '@/lib/utils'

export default function ImageUploader({
  onImageSelect
}: {
  onImageSelect: (file: File, dataUrl: string) => void
}) {
  const { isMobile } = useIsMobile()
  const [isDragOver, setIsDragOver] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const readerRef = useRef<FileReader | null>(null)
  useEffect(
    () => () => {
      readerRef.current?.abort()
    },
    []
  )
  function handleFile(file: File) {
    readerRef.current?.abort()
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError('不支持此格式，请使用 PNG、JPG 或 WEBP。')
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
    <div className="animate-fade-in mx-auto w-full max-w-xl">
      <Card
        role="button"
        tabIndex={0}
        aria-label={isMobile ? '点击选择图片' : '拖入图片或点击选择'}
        className={cn(
          'glass-card group flex min-h-72 cursor-pointer flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed p-8 transition-all md:min-h-80',
          isDragOver
            ? 'scale-[1.02] border-primary bg-primary/5'
            : 'border-border hover:border-primary/50',
          error && 'border-destructive/50'
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
          onClick={(event) => event.stopPropagation()}
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) handleFile(file)
            event.target.value = ''
          }}
        />
        <div className="flex size-16 items-center justify-center rounded-2xl bg-secondary text-muted-foreground group-hover:text-primary">
          {isDragOver ? <ImageIcon className="size-8" /> : <Upload className="size-8" />}
        </div>
        <div className="text-center">
          <p className="text-sm font-medium md:text-base">
            {isDragOver ? '松开即可上传图片' : isMobile ? '点击选择图片' : '拖入图片或点击选择'}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            PNG、JPG、WEBP · 最大 {MAX_SIZE_MB}MB
          </p>
        </div>
        {error && (
          <p
            role="alert"
            className="flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive"
          >
            <X className="size-4 shrink-0" />
            {error}
          </p>
        )}
      </Card>
    </div>
  )
}
