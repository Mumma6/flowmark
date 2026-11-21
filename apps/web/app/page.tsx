import { ClosingSection } from "./components/closing-section"
import { FaqSection } from "./components/faq-section"
import { HeroSection } from "./components/hero-section"
import { SiteFooter } from "./components/site-footer"
import { SiteHeader } from "./components/site-header"
import { LandingMotion } from "../features/product-landing/motion"
import {
  HowSection,
  FactorySection,
  AgentsSection,
} from "../features/product-landing/product-story"

export default function HomePage() {
  return (
    <LandingMotion>
      <a
        className="fixed top-2.5 left-4 z-50 -translate-y-[150%] rounded-sm bg-primary px-5 py-3 text-sm font-medium text-primary-foreground focus:translate-y-0"
        href="#main"
      >
        Skip to content
      </a>
      <SiteHeader />
      <main id="main" tabIndex={-1}>
        <HeroSection />
        <HowSection />
        <FactorySection />
        <AgentsSection />
        <FaqSection />
        <ClosingSection />
      </main>
      <SiteFooter />
    </LandingMotion>
  )
}
