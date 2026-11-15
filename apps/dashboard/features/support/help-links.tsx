import { helpDestinations } from "./help-destinations"

export function HelpLinks({ documentationUrl }: { documentationUrl: string }) {
  return (
    <nav aria-label="Help" className="grid gap-3">
      <ul className="grid gap-3 text-sm">
        {helpDestinations(documentationUrl).map((destination) => (
          <li key={destination.id}>
            <a
              href={destination.href}
              className="text-primary underline underline-offset-4"
            >
              {destination.label}
            </a>
            <p className="text-xs leading-5 text-muted-foreground">
              {destination.description}
            </p>
          </li>
        ))}
      </ul>
      <p className="text-xs leading-5 text-muted-foreground">
        Public issues are visible to anyone. Leave out passwords, API keys,
        session links and private telemetry.
      </p>
    </nav>
  )
}
