export default function AppFooter() {
  return (
    <footer
      className="hidden items-center justify-center px-4 py-6 text-center md:flex"
      style={{ paddingBottom: 'calc(1.5rem + var(--safe-bottom))' }}
    >
      <p className="text-xs text-muted-foreground">
        由 Seedream 提供支持 · © {new Date().getFullYear()} Watermark Remover
      </p>
    </footer>
  )
}
