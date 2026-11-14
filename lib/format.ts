/** "mr-mime" → "Mr Mime", "ho-oh" → "Ho Oh" */
export function formatName(name: string): string {
  return name
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

/** 25 → "#0025" */
export function formatId(id: number): string {
  return `#${String(id).padStart(4, "0")}`;
}
