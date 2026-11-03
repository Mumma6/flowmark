export function workflowFamily(name: string) {
  const businessName = name.startsWith("browser.") ? name.slice(8) : name
  return businessName.includes(".") ? businessName.split(".")[0]! : "Other"
}
