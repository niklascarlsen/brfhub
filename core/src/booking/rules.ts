// The organization's rules as the separate rules the admin wrote them as:
// one per paragraph, split on blank lines.
export function ruleParagraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0);
}
