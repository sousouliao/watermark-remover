export default function AppFooter() {
  return (
    <footer
      className="hidden md:block fixed bottom-2 right-4 text-[10px] text-muted-foreground/50 pointer-events-none select-none z-50"
      style={{ paddingBottom: 'var(--safe-bottom)' }}
    >
      <p>
        由 Seedream 提供支持 · ©
        {' '}
        {new Date().getFullYear()}
        {' '}
        Watermark Remover
      </p>
    </footer>
  )
}
