import Link from "next/link"
import "./home.css"

const guides = [
  {
    href: "/docs/README",
    title: "Documentation index",
    description: "Start here for contributor and maintainer guidance.",
  },
  {
    href: "/docs/architecture",
    title: "Architecture",
    description: "Services, data boundaries, and current system limitations.",
  },
  {
    href: "/docs/development",
    title: "Development setup",
    description: "Run the workspace, demo pipeline, tests, and local database.",
  },
  {
    href: "/docs/decisions/0001-turborepo",
    title: "Architecture decisions",
    description: "Accepted decisions and their current consequences.",
  },
]

export default function HomePage() {
  return (
    <main className="internal-home">
      <p className="internal-eyebrow">LOCAL CONTRIBUTOR REFERENCE</p>
      <h1>Flowmark internal documentation</h1>
      <p className="internal-intro">
        Engineering setup, architecture, and decisions that ship with the public
        repository. Customer-facing SDK documentation lives in the separate docs
        app.
      </p>
      <div className="internal-guides">
        {guides.map((guide) => (
          <Link className="internal-guide" href={guide.href} key={guide.href}>
            <span>
              <strong>{guide.title}</strong>
              <small>{guide.description}</small>
            </span>
            <span aria-hidden="true">↗</span>
          </Link>
        ))}
      </div>
      <p className="internal-intro">
        Product vision, roadmap, infrastructure ops, and SDK release notes live
        in the local-only <code>private/</code> folder (not rendered here). Open
        those Markdown files in the editor.
      </p>
      <p className="internal-warning">
        This app has no authentication. It binds to 127.0.0.1 and must not be
        exposed or deployed publicly.
      </p>
    </main>
  )
}
