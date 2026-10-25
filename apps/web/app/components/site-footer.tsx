import { Arrow, Mark } from "./brand"
import { docsUrl } from "./site-links"

export function SiteFooter() {
  return (
    <footer className="shell site-footer">
      <div className="footer-brand">
        <a className="brand" href="/" aria-label="Flowmark home">
          <Mark />
          flowmark<span className="brand-period">.</span>
        </a>
        <p>Workflow observability for your application.</p>
      </div>
      <nav aria-label="Footer navigation">
        <a href={docsUrl}>
          Documentation <Arrow diagonal />
        </a>
        <a href="#how-it-works">How it works</a>
      </nav>
    </footer>
  )
}
