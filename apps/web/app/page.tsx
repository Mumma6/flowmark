import { ArchitectureSection } from "./components/architecture-section"
import { ClosingSection } from "./components/closing-section"
import { FaqSection } from "./components/faq-section"
import { HeroSection } from "./components/hero-section"
import { InstrumentationSection } from "./components/instrumentation-section"
import { SiteFooter } from "./components/site-footer"
import { SiteHeader } from "./components/site-header"
import { ValueSection } from "./components/value-section"

export default function HomePage() {
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <SiteHeader />
      <main id="main">
        <HeroSection />
        <ValueSection />
        <InstrumentationSection />
        <ArchitectureSection />
        <FaqSection />
        <ClosingSection />
      </main>
      <SiteFooter />
    </>
  )
}
