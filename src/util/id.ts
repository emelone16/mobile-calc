/** Showdown-style id: lowercase alphanumerics only. Matches engine `toID`. */
export function toId(s: string): string {
  return (s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '')
}
