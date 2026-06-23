export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer-ornament" aria-hidden>
        <span className="site-footer-gem" />
        <span className="site-footer-rule" />
        <span className="site-footer-gem" />
      </div>
      <p className="site-footer-copy">
        <span className="site-footer-label">Desarrollado por</span>
        <a
          href="https://rgcore.dev"
          target="_blank"
          rel="noopener noreferrer"
          className="site-footer-brand"
        >
          rgcore.dev
        </a>
      </p>
    </footer>
  );
}
