import ts from "typescript"

/** Runtime edges by default; includeTypes also checks declared type boundaries. */
export const runtimeImports = (
  filename,
  text,
  { includeTypes = false } = {},
) => {
  const source = ts.createSourceFile(
    filename,
    text,
    ts.ScriptTarget.Latest,
    true,
  )
  const visit = (node) => {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      const bindings = ts.isImportDeclaration(node)
        ? node.importClause?.namedBindings
        : node.exportClause
      const typeOnly =
        node.isTypeOnly ||
        node.importClause?.isTypeOnly ||
        (!node.importClause?.name &&
          bindings &&
          (ts.isNamedImports(bindings) || ts.isNamedExports(bindings)) &&
          bindings.elements.length > 0 &&
          bindings.elements.every((element) => element.isTypeOnly))
      return typeOnly && !includeTypes ? [] : [node.moduleSpecifier.text]
    }
    if (
      includeTypes &&
      ts.isImportTypeNode(node) &&
      ts.isLiteralTypeNode(node.argument) &&
      ts.isStringLiteral(node.argument.literal)
    ) {
      return [node.argument.literal.text]
    }
    if (
      ts.isImportEqualsDeclaration(node) &&
      ts.isExternalModuleReference(node.moduleReference) &&
      ts.isStringLiteral(node.moduleReference.expression)
    ) {
      return node.isTypeOnly && !includeTypes
        ? []
        : [node.moduleReference.expression.text]
    }
    if (
      ts.isCallExpression(node) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) &&
          node.expression.text === "require")) &&
      node.arguments[0] &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      return [node.arguments[0].text]
    }
    return node.getChildren(source).flatMap(visit)
  }
  return visit(source)
}

export const sourceGraph = (sources, resolve) =>
  new Map(
    [...sources].map(([file, text]) => [
      file,
      runtimeImports(file, text).map((specifier) => resolve(file, specifier)),
    ]),
  )

/** Traversal state is local to this tooling invocation, never application state. */
export const reachable = (graph, roots) => {
  const visited = new Set()
  const visit = (file) => {
    if (visited.has(file)) {
      return
    }
    visited.add(file)
    ;(graph.get(file) ?? []).forEach(visit)
  }
  roots.forEach(visit)
  return [...visited]
}

export const runtimeCycles = (graph) => {
  const visited = new Set()
  const cycles = []
  const visit = (file, path) => {
    if (path.includes(file)) {
      cycles.push([...path.slice(path.indexOf(file)), file])
      return
    }
    if (visited.has(file)) {
      return
    }
    visited.add(file)
    ;(graph.get(file) ?? []).forEach((dependency) =>
      visit(dependency, [...path, file]),
    )
  }
  ;[...graph.keys()].forEach((file) => visit(file, []))
  return cycles
}
