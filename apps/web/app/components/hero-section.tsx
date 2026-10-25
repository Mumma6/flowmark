import { Button } from "@flowmark/ui"
import { Spotlight } from "@/components/ui/spotlight"
import { Arrow } from "./brand"
import { DashboardIllustration } from "./dashboard-illustration"
import { docsUrl } from "./site-links"

export function HeroSection() {
  return (
    <section className="hero" aria-labelledby="hero-title">
      <div className="hero-grid" aria-hidden="true" />
      <div className="hero-glow" aria-hidden="true" />
      <Spotlight className="hero-spotlight" fill="#b9f597" aria-hidden={true} />
      <div className="shell hero-content">
        <div className="hero-copy">
          <p className="overline">
            WORKFLOW OBSERVABILITY FOR TYPESCRIPT APPLICATIONS
          </p>
          <h1 id="hero-title">Know what your application actually does.</h1>
          <p className="hero-description">
            Track the processes that matter. See every execution, its progress,
            errors, and business outcomes in one place. Just a few TypeScript
            markers. No workflow engine. No custom dashboards.
          </p>
          <div className="button-row">
            <Button asChild className="button button-primary" size="lg">
              <a href="#how-it-works">
                See how it works <Arrow />
              </a>
            </Button>
            <a className="text-link" href={docsUrl}>
              Read the SDK docs <Arrow diagonal />
            </a>
          </div>
          <p className="hero-note">
            Your application owns the work. Flowmark records what your code
            reports.
          </p>
        </div>

        <div className="hero-visual">
          <DashboardIllustration />
          <span className="visual-orbit orbit-one" aria-hidden="true" />
          <span className="visual-orbit orbit-two" aria-hidden="true" />
        </div>
      </div>
    </section>
  )
}
