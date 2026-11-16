import ts from "typescript"
import { posix } from "node:path"

// These are explicit syntax rules, not a substitute for contextual review.
export const effectFindings = (file, text) => {
  if (!text || !/^packages\/[^/]+\/src\/.*\.tsx?$/.test(file)) {
    return []
  }
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true)
  const effectImports = new Map()
  const namespaceImports = new Set()
  source.statements.forEach((node) => {
    if (
      ts.isImportDeclaration(node) &&
      ts.isStringLiteral(node.moduleSpecifier) &&
      node.moduleSpecifier.text === "effect"
    ) {
      const bindings = node.importClause?.namedBindings
      if (bindings && ts.isNamedImports(bindings)) {
        bindings.elements.forEach((binding) =>
          effectImports.set(
            binding.name.text,
            binding.propertyName?.text ?? binding.name.text,
          ),
        )
      }
      if (bindings && ts.isNamespaceImport(bindings)) {
        namespaceImports.add(bindings.name.text)
      }
    }
    if (
      ts.isImportDeclaration(node) &&
      ts.isStringLiteral(node.moduleSpecifier) &&
      /^effect\/(Effect|Context|Either)$/.test(node.moduleSpecifier.text)
    ) {
      const bindings = node.importClause?.namedBindings
      const name = node.moduleSpecifier.text.split("/")[1]
      if (bindings && ts.isNamespaceImport(bindings)) {
        effectImports.set(bindings.name.text, name)
      }
    }
  })
  const issue = (node, rule, message) => ({
    file,
    line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1,
    rule,
    message,
  })
  const moduleName = (node) => {
    if (ts.isIdentifier(node)) {
      return effectImports.get(node.text)
    }
    if (
      ts.isPropertyAccessExpression(node) &&
      ts.isIdentifier(node.expression) &&
      namespaceImports.has(node.expression.text)
    ) {
      return node.name.text
    }
    return undefined
  }
  const visit = (node) => {
    const own = []
    if (ts.isPropertyAccessExpression(node)) {
      const owner = moduleName(node.expression)
      if (
        (owner === "Effect" &&
          ["Service", "catchAll", "either"].includes(node.name.text)) ||
        (owner === "Context" && ["Tag", "GenericTag"].includes(node.name.text))
      ) {
        own.push(
          issue(
            node,
            "effect-v4",
            "Use installed Effect 4 APIs; see flowmark-effect.",
          ),
        )
      }
      if (
        owner === "Effect" &&
        /^run(Sync|Promise|Fork)/.test(node.name.text) &&
        /\/(use-cases|ports|rules)\//.test(file)
      ) {
        own.push(
          issue(
            node,
            "effect-execution",
            "Execute Effects at a runtime/public boundary, outside use cases, ports and rules.",
          ),
        )
      }
    }
    if (
      ts.isImportSpecifier(node) &&
      (node.propertyName?.text ?? node.name.text) === "Either" &&
      effectImports.get(node.name.text) === "Either"
    ) {
      own.push(
        issue(node, "effect-v4", "Effect 4 uses Result instead of Either."),
      )
    }
    if (/\/(use-cases|rules)\//.test(file)) {
      if (
        ts.isForStatement(node) ||
        ts.isForOfStatement(node) ||
        ts.isForInStatement(node) ||
        ts.isWhileStatement(node) ||
        ts.isDoStatement(node)
      ) {
        own.push(
          issue(
            node,
            "functional-iteration",
            "Use collection operators or Effect iteration; see flowmark-effect.",
          ),
        )
      }
      if (
        (ts.isFunctionDeclaration(node) ||
          ts.isFunctionExpression(node) ||
          ts.isArrowFunction(node)) &&
        node.modifiers?.some(
          (modifier) => modifier.kind === ts.SyntaxKind.AsyncKeyword,
        )
      ) {
        own.push(
          issue(
            node,
            "effect-workflow",
            "Keep internal use cases/rules in Effect; Promises belong at external boundaries.",
          ),
        )
      }
    }
    return [...own, ...node.getChildren(source).flatMap(visit)]
  }
  return visit(source)
}

const lineAt = (text, index) => text.slice(0, index).split("\n").length
const markdown = (file) => /\.(md|mdx|mdc)$/.test(file)
const sourceDocs = (tree) => [...tree].filter(([file]) => markdown(file))
const knownPath = (tree, target) =>
  tree.has(target) ||
  [...tree.keys()].some((file) => file.startsWith(`${target}/`))

export const documentationFindings = (tree) =>
  sourceDocs(tree).flatMap(([file, text]) => {
    // Inline Markdown links only. Code fences and inline code are not links.
    const prose = text
      .replace(/^(`{3,}|~{3,})[^\n]*\n[\s\S]*?^\1\s*$/gm, (code) =>
        code.replace(/[^\n]/g, " "),
      )
      .replace(/`[^`\n]*`/g, (code) => " ".repeat(code.length))
    return [
      ...prose.matchAll(/!?\[[^\]\n]*\]\(<?([^\s)>]+)>?(?:\s+"[^"]*")?\)/g),
    ].flatMap((match) => {
      const href = match[1]
      if (/^(?:[a-z][a-z\d+.-]*:|\/|#)/i.test(href) || href.includes("{")) {
        return []
      }
      let decoded
      try {
        decoded = decodeURIComponent(href.split(/[?#]/)[0])
      } catch {
        return [
          {
            file,
            line: lineAt(text, match.index),
            rule: "documentation-link",
            message: `Invalid encoded link: ${href}`,
          },
        ]
      }
      if (!decoded) {
        return []
      }
      const target = posix.normalize(posix.join(posix.dirname(file), decoded))
      return knownPath(tree, target)
        ? []
        : [
            {
              file,
              line: lineAt(text, match.index),
              rule: "documentation-link",
              message: `Local link target does not exist: ${href}`,
            },
          ]
    })
  })

export const ownershipFindings = (tree) => {
  const manifests = [...tree]
    .filter(([file]) => /^(apps|packages)\/[^/]+\/package.json$/.test(file))
    .map(([file, text]) => ({ file, ...JSON.parse(text) }))
  const owners = new Map(manifests.map((pkg) => [pkg.name, pkg]))
  return manifests.flatMap((pkg) => {
    const dependencies = Object.keys({
      ...pkg.dependencies,
      ...pkg.devDependencies,
      ...pkg.peerDependencies,
    })
    return dependencies.flatMap((dependency) => {
      const target = owners.get(dependency)
      if (!target) {
        return []
      }
      const disallowed =
        (pkg.file.startsWith("packages/") && target.file.startsWith("apps/")) ||
        (pkg.name === "@flowmark/core" && target.name !== "@flowmark/core") ||
        (pkg.name === "@flowmark/db" &&
          ["@flowmark/auth", "@flowmark/api", "@flowmark/engine"].includes(
            dependency,
          )) ||
        (pkg.name === "@flowmark/engine" &&
          !["@flowmark/core"].includes(dependency))
      return disallowed
        ? [
            {
              file: pkg.file,
              line: 1,
              rule: "package-ownership",
              message: `${pkg.name} must not depend on ${dependency}; see flowmark-architecture.`,
            },
          ]
        : []
    })
  })
}

export const commandFindings = (before, after) => {
  const scripts = (tree) =>
    JSON.parse(tree.get("package.json") ?? "{}").scripts ?? {}
  const removed = Object.keys(scripts(before)).filter(
    (command) => !Object.hasOwn(scripts(after), command),
  )
  return sourceDocs(after).flatMap(([file, text]) => {
    const commands = [...text.matchAll(/\bpnpm ([\w:.-]+)/g)].map(
      (match) => match[1],
    )
    return removed
      .filter((command) => commands.includes(command))
      .map((command) => ({
        file,
        line: 1,
        rule: "documented-command",
        message: `Removed root script is still documented: pnpm ${command}`,
      }))
  })
}

export const organizationFindings = (tree) =>
  [...tree.keys()].flatMap((file) => {
    if (
      !/^packages\/[^/]+\/src\/.*\.tsx?$/.test(file) ||
      file.endsWith(".d.ts")
    ) {
      return []
    }
    const invalid =
      file.includes("/test/") ||
      /\.(test|spec)\.tsx?$/.test(file) ||
      !/^[a-z0-9.-]+$/.test(posix.basename(file)) ||
      (/^packages\/sdk\/src\/[^/]+$/.test(file) &&
        file !== "packages/sdk/src/index.ts")
    return invalid
      ? [
          {
            file,
            line: 1,
            rule: "source-organization",
            message:
              "Use responsibility-named kebab-case source files and package-level test/; SDK root contains only index.ts. See flowmark-architecture.",
          },
        ]
      : []
  })

const identity = ({ file, rule, message }) =>
  JSON.stringify([file, rule, message])
// Compare counts, not line positions: old debt and shifted lines do not fail PRs.
export const regressions = (before, after) => {
  const counts = new Map()
  before.forEach((finding) =>
    counts.set(identity(finding), (counts.get(identity(finding)) ?? 0) + 1),
  )
  return after.filter((finding) => {
    const key = identity(finding)
    const count = counts.get(key) ?? 0
    counts.set(key, count - 1)
    return count <= 0
  })
}

export const inspect = (before, after) => {
  const analyze = (tree) => [
    ...[...tree].flatMap(([file, text]) => effectFindings(file, text)),
    ...documentationFindings(tree),
    ...ownershipFindings(tree),
    ...organizationFindings(tree),
  ]
  return [
    ...regressions(analyze(before), analyze(after)),
    ...commandFindings(before, after),
  ]
}
