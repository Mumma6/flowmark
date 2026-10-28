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
    <CodeBlockContent
      className="overflow-auto text-xs leading-[1.9]"
      lineNumbers
    >
      {lines.map((line, index) => (
        <CodeBlockLine
          key={index}
          className={
            /\b(?:flowmark\.workflow|run\.(?:step|done|fail|progress))\(/.test(
              sourceLines[index] ?? "",
            )
              ? "bg-primary/10 shadow-[inset_2px_0_0_var(--accent)]"
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
    <CodeBlock className="w-full border-white/15 bg-[#080d0e]">
      <CodeBlockHeader className="min-h-12 px-3 sm:px-3.5">
        <CodeBlockTitle>{title}</CodeBlockTitle>
        <CodeBlockActions>
          <span className="text-[10px] text-muted-foreground">TypeScript</span>
          <CodeBlockCopyButton
            className="border border-border text-[#c6d2c9]"
            value={value}
            variant="ghost"
          />
        </CodeBlockActions>
      </CodeBlockHeader>
      <HighlightedCode value={value} />
    </CodeBlock>
  )
}
