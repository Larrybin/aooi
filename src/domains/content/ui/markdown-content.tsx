import { renderMarkdown } from './render-markdown';

export function MarkdownContent({ content }: { content: string }) {
  const html = renderMarkdown(content);

  return (
    <div className="markdown-body" dangerouslySetInnerHTML={{ __html: html }} />
  );
}
