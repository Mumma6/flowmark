import { handleIngestion } from "../../../src/adapters/ingestion-http"

export const runtime = "nodejs"
export const maxDuration = 30

export const POST = handleIngestion
