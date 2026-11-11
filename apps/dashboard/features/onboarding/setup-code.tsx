import {
  CodeBlock,
  CodeBlockActions,
  CodeBlockContent,
  CodeBlockCopyButton,
  CodeBlockHeader,
  CodeBlockTitle,
} from "@flowmark/ui"
export function SetupCode({ title, value }: { title: string; value: string }) {
  return (
    <CodeBlock className="min-w-0 border-border bg-background/70">
      <CodeBlockHeader className="px-4">
        <CodeBlockTitle>{title}</CodeBlockTitle>
        <CodeBlockActions>
          <CodeBlockCopyButton value={value} className="h-8 text-[10px]" />
        </CodeBlockActions>
      </CodeBlockHeader>
      <CodeBlockContent
        tabIndex={0}
        className="max-h-80 overflow-auto whitespace-pre-wrap break-words p-4 text-[11px] leading-7"
      >
        {value}
      </CodeBlockContent>
    </CodeBlock>
  )
}
