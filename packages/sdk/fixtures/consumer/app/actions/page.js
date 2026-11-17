import { importAction } from "./action.js"

export default function Page() {
  return (
    <form action={importAction}>
      <button type="submit">Import</button>
    </form>
  )
}
