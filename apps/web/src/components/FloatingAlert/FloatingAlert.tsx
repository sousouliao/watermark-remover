import { useRef } from 'react'
import { Alert, AlertClose, AlertContent, AlertDescription, AlertIcon } from '@/components/motion/alert'

/** 视口顶部悬浮的错误提示：出现和消失都不推挤页面内容。 */
export default function FloatingAlert({
  message,
  onDismiss,
}: {
  message: string | null
  onDismiss: () => void
}) {
  // 退场动画期间 message 已为空，保留最后一条文案避免提示先变空再消失。
  const lastMessage = useRef(message)
  if (message) lastMessage.current = message

  return (
    <div className="pointer-events-none fixed inset-x-4 top-[calc(1rem+var(--safe-top))] z-50 mx-auto max-w-xl">
      <Alert
        variant="destructive"
        open={!!message}
        onOpenChange={open => !open && onDismiss()}
        className="pointer-events-auto bg-background"
      >
        <AlertIcon />
        <AlertContent>
          <AlertDescription>{lastMessage.current}</AlertDescription>
        </AlertContent>
        <AlertClose />
      </Alert>
    </div>
  )
}
