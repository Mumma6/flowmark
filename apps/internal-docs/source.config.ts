import { pageSchema } from "fumadocs-core/source/schema"
import { defineDocs, defineConfig } from "fumadocs-mdx/config"

function getPageTitle(path: string, source: string) {
  const heading = source.match(/^#\s+(.+)$/m)?.[1]
  if (heading) {
    return heading.replaceAll("`", "")
  }

  const filename =
    path
      .split("/")
      .at(-1)
      ?.replace(/\.mdx?$/, "") ?? "Guide"
  return filename
    .replace(/^\d+-/, "")
    .replaceAll("-", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

export const docs = defineDocs({
  dir: "../../docs",
  docs: {
    schema: ({ path, source }) =>
      pageSchema.extend({
        title: pageSchema.shape.title.default(getPageTitle(path, source)),
      }),
  },
})

export default defineConfig()
