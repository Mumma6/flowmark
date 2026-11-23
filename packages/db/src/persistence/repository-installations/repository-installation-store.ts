import { Context, Effect, Layer } from "effect"
import { Database, DatabaseCancellation, provideDatabase } from "../database.js"
import {
  getRepositoryInstallation,
  getRepositoryInstallationForProject,
} from "./queries/get-repository-installation.js"
import { listRepositoryInstallations } from "./queries/list-repository-installations.js"
import { recordInstallationDelivery } from "./writes/record-installation-delivery.js"
import { recordInstallationPr } from "./writes/record-installation-pr.js"
import { recordInstallationVerification } from "./writes/record-installation-verification.js"
import { revokeRepositoryInstallation } from "./writes/revoke-repository-installation.js"
import { upsertRepositoryInstallation } from "./writes/upsert-repository-installation.js"

export class RepositoryInstallationStore extends Context.Service<RepositoryInstallationStore>()(
  "@flowmark/db/RepositoryInstallationStore",
  {
    make: Effect.gen(function* () {
      const db = yield* Database
      const provide = provideDatabase(db, yield* DatabaseCancellation)
      return {
        list: (...args: Parameters<typeof listRepositoryInstallations>) =>
          provide(listRepositoryInstallations(...args)),
        get: (...args: Parameters<typeof getRepositoryInstallation>) =>
          provide(getRepositoryInstallation(...args)),
        getForProject: (
          ...args: Parameters<typeof getRepositoryInstallationForProject>
        ) => provide(getRepositoryInstallationForProject(...args)),
        upsert: (...args: Parameters<typeof upsertRepositoryInstallation>) =>
          provide(upsertRepositoryInstallation(...args)),
        recordDelivery: (
          ...args: Parameters<typeof recordInstallationDelivery>
        ) => provide(recordInstallationDelivery(...args)),
        recordPr: (...args: Parameters<typeof recordInstallationPr>) =>
          provide(recordInstallationPr(...args)),
        recordVerification: (
          ...args: Parameters<typeof recordInstallationVerification>
        ) => provide(recordInstallationVerification(...args)),
        revoke: (...args: Parameters<typeof revokeRepositoryInstallation>) =>
          provide(revokeRepositoryInstallation(...args)),
      }
    }),
  },
) {
  static readonly layer = Layer.effect(this, this.make)
}
