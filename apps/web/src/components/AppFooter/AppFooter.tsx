export default function AppFooter() {
  return (
    <footer
      className="hidden items-center justify-center px-4 py-2 text-center md:flex"
      style={{ paddingBottom: 'calc(0.5rem + var(--safe-bottom))' }}
    >
      <p className="text-[11px] text-muted-foreground/70">
        由 Seedream 提供支持 · ©
        {' '}
        {new Date().getFullYear()}
        {' '}
        Watermark Remover
      </p>
    </footer>
  )
}
