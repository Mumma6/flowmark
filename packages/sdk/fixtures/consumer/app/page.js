import { flowmark } from "../lib/flowmark.js"

// A statically prerendered page can import the client without credentials.
export default function Page() {
  return <main>SDK ready: {typeof flowmark.workflow}</main>
}
