import { Arrow, Mark } from "./brand"
import { docsUrl } from "./site-links"

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="shell header-inner">
        <a className="brand" href="/" aria-label="Flowmark home">
          <Mark />
          flowmark<span className="brand-period">.</span>
        </a>
        <nav aria-label="Main navigation">
          <a href="#how-it-works">How it works</a>
          <a href={docsUrl}>
            Documentation <Arrow diagonal />
          </a>
        </nav>
      </div>
    </header>
  )
}
