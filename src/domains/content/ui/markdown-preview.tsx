'use client';

import { useMemo } from 'react';
import GithubSlugger from 'github-slugger';
import MarkdownIt from 'markdown-it';

import 'github-markdown-css/github-markdown-light.css';
import '@/shared/blocks/common/markdown.css';

export interface TocItem {
  id: string;
  text: string;
  level: number;
}

export function getTocItems(content: string): TocItem[] {
  if (!content) return [];

  const headingRegex = /^(#{1,6})\s+(.+)$/gm;
  const toc: TocItem[] = [];
  const slugger = new GithubSlugger();
  let match;

  while ((match = headingRegex.exec(content)) !== null) {
    const level = match[1].length;
    const text = match[2].trim();
    const id = slugger.slug(text);

    toc.push({ id, text, level });
  }

  return toc;
}

type MarkdownEnv = { headingSlugger?: GithubSlugger };

function getOrCreateHeadingSlugger(env: unknown): GithubSlugger {
  if (env && typeof env === 'object') {
    const typedEnv = env as MarkdownEnv;
    if (!typedEnv.headingSlugger) {
      typedEnv.headingSlugger = new GithubSlugger();
    }
    return typedEnv.headingSlugger;
  }

  return new GithubSlugger();
}

const md = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: true,
});

md.renderer.rules.heading_open = function (
  tokens,
  idx,
  options,
  env,
  renderer
) {
  const nextToken = tokens[idx + 1];

  if (nextToken && nextToken.type === 'inline') {
    const token = tokens[idx];
    const slugger = getOrCreateHeadingSlugger(env);
    token.attrSet('id', slugger.slug(nextToken.content));
  }

  return renderer.renderToken(tokens, idx, options);
};

md.renderer.rules.link_open = function (tokens, idx, options, env, renderer) {
  const token = tokens[idx];
  const hrefIndex = token.attrIndex('href');

  if (hrefIndex >= 0) {
    const href = token.attrGet('href');
    token.attrSet('rel', 'nofollow');
    if (href && (href.startsWith('http://') || href.startsWith('https://'))) {
      token.attrSet('target', '_blank');
      token.attrSet('rel', 'nofollow noopener noreferrer');
    }
  }

  return renderer.renderToken(tokens, idx, options);
};

export function MarkdownPreview({ content }: { content: string }) {
  const html = useMemo(() => {
    if (!content) return '';
    const env: MarkdownEnv = {};
    return md.render(content, env);
  }, [content]);

  return (
    <div className="markdown-body" dangerouslySetInnerHTML={{ __html: html }} />
  );
}
