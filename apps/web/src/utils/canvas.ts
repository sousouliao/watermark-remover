import type { Point } from '@/types/mask'

/**
 * 从鼠标或触摸事件中提取相对于 canvas 的坐标点
 */
export function getCanvasPoint(e: MouseEvent | TouchEvent, canvas: HTMLCanvasElement): Point | null {
  const rect = canvas.getBoundingClientRect()
  let clientX: number
  let clientY: number
  if ('touches' in e) {
    clientX = e.touches[0].clientX
    clientY = e.touches[0].clientY
  }
  else {
    clientX = e.clientX
    clientY = e.clientY
  }
  return {
    x: clientX - rect.left,
    y: clientY - rect.top,
  }
}
