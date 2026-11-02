import { CodeBlock, CodeBlockContent } from "@flowmark/ui"

export function JsonData({ value }: { value: unknown }) {
  return (
    <CodeBlock>
      <CodeBlockContent className="max-h-96 text-xs leading-7 text-[#dde9df]">
        {JSON.stringify(value, null, 2)}
      </CodeBlockContent>
    </CodeBlock>
  )
}
