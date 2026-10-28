import { Data } from "effect"

export class CommandConfigurationError extends Data.TaggedError(
  "CommandConfigurationError",
)<{
  readonly reason: string
}> {}

export class MissingDatabaseUrlError extends Data.TaggedError(
  "MissingDatabaseUrlError",
)<{
  readonly reason: string
}> {}

export class MissingMigrationUrlError extends Data.TaggedError(
  "MissingMigrationUrlError",
)<{
  readonly reason: string
}> {}

export class ProductionEnvironmentError extends Data.TaggedError(
  "ProductionEnvironmentError",
)<{
  readonly reason: string
}> {}

export class DemoModeRequiredError extends Data.TaggedError(
  "DemoModeRequiredError",
)<{
  readonly reason: string
}> {}

export class LoopbackDatabaseError extends Data.TaggedError(
  "LoopbackDatabaseError",
)<{
  readonly reason: string
}> {}

export class PreviewDatabaseError extends Data.TaggedError(
  "PreviewDatabaseError",
)<{
  readonly reason: string
}> {}

export class PreviewAuthOriginError extends Data.TaggedError(
  "PreviewAuthOriginError",
)<{
  readonly reason: string
}> {}

export class PreviewDashboardApiError extends Data.TaggedError(
  "PreviewDashboardApiError",
)<{
  readonly reason: string
}> {}

export class PreviewBaselineError extends Data.TaggedError(
  "PreviewBaselineError",
)<{
  readonly reason: string
}> {}
