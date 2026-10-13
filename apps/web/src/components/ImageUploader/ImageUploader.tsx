import { useEffect, useRef, useState } from 'react'
import { Alert, AlertContent, AlertDescription, AlertIcon } from '@/components/motion/alert'
import { FileUpload } from '@/components/motion/file-upload'
import { ACCEPTED_TYPES, MAX_SIZE_BYTES, MAX_SIZE_MB } from '@/constants/upload'
import { useIsMobile } from '@/hooks/useIsMobile'

export default function ImageUploader({
  onImageSelect,
}: {
  onImageSelect: (file: File, dataUrl: string) => void
}) {
  const { isMobile } = useIsMobile()
  const [error, setError] = useState<string | null>(null)
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
    <div className="mx-auto flex w-full max-w-xl flex-col gap-3">
      {error && (
        <Alert variant="destructive" open={!!error} onOpenChange={open => !open && setError(null)}>
          <AlertIcon />
          <AlertContent>
            <AlertDescription>{error}</AlertDescription>
          </AlertContent>
        </Alert>
      )}

      <FileUpload
        accept={ACCEPTED_TYPES.join(',')}
        multiple={false}
        maxFiles={1}
        variant="centered"
        title={isMobile ? '轻触选择图片' : '拖入图片，或点击浏览'}
        description={`PNG · JPG · WEBP · 单张最大 ${MAX_SIZE_MB}MB`}
        browseLabel="选择文件"
        onFilesAdded={(_items, files) => {
          if (files[0]) handleFile(files[0])
        }}
        classNames={{
          queue: 'hidden',
        }}
      />
    </div>
  )
}
