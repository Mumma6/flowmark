"use client"

import {
  CodeBlock,
  CodeBlockActions,
  CodeBlockContent,
  CodeBlockCopyButton,
  CodeBlockHeader,
  CodeBlockLine,
  CodeBlockTitle,
  useHighlightedCode,
} from "@flowmark/ui"

function HighlightedCode({ value }: { value: string }) {
  const lines = useHighlightedCode(value, "typescript")
  const sourceLines = value.split("\n")

  return (
    <CodeBlockContent className="workflow-code-content" lineNumbers>
      {lines.map((line, index) => (
        <CodeBlockLine
          key={index}
          className={
            /\b(?:flowmark\.workflow|run\.(?:step|done|fail|progress))\(/.test(
              sourceLines[index] ?? "",
            )
              ? "instrumentation-line"
              : undefined
          }
        >
          {line}
        </CodeBlockLine>
      ))}
    </CodeBlockContent>
  )
}

export function WorkflowCodeBlock({
  title,
  value,
}: {
  title: string
  value: string
}) {
  return (
    <CodeBlock className="workflow-code-block">
      <CodeBlockHeader className="workflow-code-header">
        <CodeBlockTitle>{title}</CodeBlockTitle>
        <CodeBlockActions>
          <span className="code-language">TypeScript</span>
          <CodeBlockCopyButton
            className="code-copy-button"
            value={value}
            variant="ghost"
          />
        </CodeBlockActions>
      </CodeBlockHeader>
      <HighlightedCode value={value} />
    </CodeBlock>
  )
}
