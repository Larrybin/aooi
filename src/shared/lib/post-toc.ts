import { generateTOC } from '@/core/docs/toc';

export function buildPostTocFromMarkdown(content: string) {
  return generateTOC(content);
}
