/* eslint unused-imports/no-unused-imports: "off", no-unused-vars: ["error", { "varsIgnorePattern": "^(ArrowDownToLine|Image|Link|RotateCcw|X|PaperScene)$" }] -- Root config does not track JSX-only component references. */
import { ArrowDownToLine, Image, Link, RotateCcw, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { PaperScene } from './PaperScene.jsx'

const SAMPLE = '/assets/sample-coast.png'
export function App() {
  const [imageUrl, setImageUrl] = useState(SAMPLE)
  const [filename, setFilename] = useState('沿海日落 · 示例照片')
  const [ready, setReady] = useState(false)
  const [phase, setPhase] = useState('idle')
  const [progress, setProgress] = useState(0)
  const [taken, setTaken] = useState(0)
  const [error, setError] = useState('')
  const [viewPhoto, setViewPhoto] = useState(false)
  const animation = useRef(0)
  const upload = useRef(null)
  const objectUrl = useRef(null)
  useEffect(() => () => {
    cancelAnimationFrame(animation.current)
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current)
  }, [])

  function print() {
    if (!ready || phase === 'printing') return
    cancelAnimationFrame(animation.current)
    setError('')
    setProgress(0)
    setTaken(0)
    setPhase('printing')
    const start = performance.now()
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    function frame(now) {
      const elapsed = now - start
      const p = reduced ? 1 : Math.max(0, Math.min(1, (elapsed - 450) / 3800))
      setProgress(p)
      if (p < 1) animation.current = requestAnimationFrame(frame)
      else setPhase('done')
    }
    animation.current = requestAnimationFrame(frame)
  }
  function take() {
    const start = performance.now()
    function frame(now) {
      const t = Math.min(1, (now - start) / 500)
      setTaken(t * (2 - t))
      if (t < 1) {
        animation.current = requestAnimationFrame(frame)
      }
      else {
        setPhase('taken')
        setViewPhoto(true)
      }
    }
    animation.current = requestAnimationFrame(frame)
  }
  function choose(event) {
    const file = event.target.files?.[0]
    if (!file) return
    cancelAnimationFrame(animation.current)
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current)
    objectUrl.current = URL.createObjectURL(file)
    setReady(false)
    setError('')
    setProgress(0)
    setTaken(0)
    setPhase('idle')
    setFilename(file.name)
    setImageUrl(objectUrl.current)
    event.target.value = ''
  }
  const busy = phase === 'printing'
  const screen = !ready ? '准备照片' : busy ? (progress === 0 ? '正在启动' : '正在打印 · 01 / 01') : phase === 'done' ? '打印完成 · 01 / 01' : phase === 'taken' ? '照片已取出' : '准备就绪'
  return (
    <main className="app">
      <header>
        <h1>小红书解析</h1>
        <span>打印机样机</span>
      </header>
      <section className="workspace" aria-label="照片打印机">
        <div className="photo-input">
          <Link size={19} aria-hidden="true" />
          <span>{filename}</span>
          <button type="button" disabled={busy} onClick={() => upload.current.click()} aria-label="选择一张本地照片"><Image size={20} /></button>
          <input ref={upload} type="file" accept="image/*" onChange={choose} hidden />
        </div>
        <div className={`printer-stage ${busy ? 'is-printing' : ''} ${phase === 'taken' ? 'photo-taken' : ''}`}>
          <img className="housing" src="/assets/printer-body.png" alt="哑光白色照片打印机，带黑色出纸口、实体按钮和托盘" />
          <PaperScene
            imageUrl={imageUrl}
            progress={progress}
            taken={taken}
            onReady={() => setReady(true)}
            onError={(message) => {
              setError(message)
              setReady(false)
            }}
          />
          <div className="machine-screen" role="status" aria-live="polite">{screen}</div>
          <button className="machine-button" type="button" disabled={!ready || busy} onClick={print} aria-label={busy ? '正在打印' : '打印照片'} title="打印照片" />
          <img className="button-face" src="/assets/printer-body.png" alt="" aria-hidden="true" />
          <span className="button-label">打印照片</span>
        </div>
        <div className="output-actions">
          <p className="caption">{error || (busy ? '相纸正在送出' : phase === 'done' ? '照片已就绪，轻点取出' : phase === 'taken' ? '已取出 1 张照片' : '使用示例照片，或选择本地图片体验')}</p>
          <div className="actions">
            {phase === 'done' && <button className="take" onClick={take}>取出照片</button>}
            <a className={`action ${phase === 'done' || phase === 'taken' ? '' : 'disabled'}`} href={imageUrl} download="photo.png" onClick={(e) => { if (phase !== 'done' && phase !== 'taken') e.preventDefault() }} aria-disabled={phase !== 'done' && phase !== 'taken'}>
              <ArrowDownToLine size={16} />
              下载照片
            </a>
            <button disabled={busy || !ready} onClick={print}>
              <RotateCcw size={15} />
              {phase === 'idle' ? '开始打印' : '再打印一张'}
            </button>
          </div>
        </div>
      </section>
      <footer>
        <span className="active">小红书解析</span>
        <span>图片去水印</span>
      </footer>
      {viewPhoto && (
        <div
          className="photo-dialog"
          role="dialog"
          aria-modal="true"
          aria-label="已打印照片"
          onKeyDown={(e) => {
            if (e.key === 'Escape') setViewPhoto(false)
            if (e.key === 'Tab') {
              const nodes = [...e.currentTarget.querySelectorAll('button,a')]
              const target = e.shiftKey ? nodes[0] : nodes.at(-1)
              if (document.activeElement === target) {
                e.preventDefault()
                const next = e.shiftKey ? nodes.at(-1) : nodes[0]
                next.focus()
              }
            }
          }}
          onClick={() => setViewPhoto(false)}
        >
          <button className="close" aria-label="关闭照片预览" autoFocus onClick={() => setViewPhoto(false)}><X size={22} /></button>
          <img src={imageUrl} alt="已打印的原始照片" onClick={e => e.stopPropagation()} />
          <a href={imageUrl} download="photo.png" onClick={e => e.stopPropagation()}>
            <ArrowDownToLine size={16} />
            下载原图
          </a>
        </div>
      )}
    </main>
  )
}
