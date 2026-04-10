export function splitBlogContentForInlineAd(content: string) {
  const sections = content
    .split(/\n{2,}/)
    .map((section) => section.trim())
    .filter(Boolean);

  if (sections.length < 6) {
    return null;
  }

  const splitIndex = Math.min(
    sections.length - 2,
    Math.max(3, Math.floor(sections.length * 0.6))
  );

  return {
    before: sections.slice(0, splitIndex).join('\n\n'),
    after: sections.slice(splitIndex).join('\n\n'),
  };
}
