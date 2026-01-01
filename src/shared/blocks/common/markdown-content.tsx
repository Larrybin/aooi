// Server-side Markdown renderer for database posts
import GithubSlugger from 'github-slugger';
import MarkdownIt from 'markdown-it';

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
  // Security: database markdown is treated as untrusted input; do not allow raw HTML.
  html: false,
  linkify: true,
  breaks: true,
});

// Custom renderer for headings with IDs
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

// Custom renderer for links with nofollow
md.renderer.rules.link_open = function (tokens, idx, options, env, renderer) {
  const token = tokens[idx];
  const hrefIndex = token.attrIndex('href');

  if (hrefIndex >= 0) {
    const href = token.attrGet('href');
    // Add nofollow to all links
    token.attrSet('rel', 'nofollow');
    // Optionally add target="_blank" for external links
    if (href && (href.startsWith('http://') || href.startsWith('https://'))) {
      token.attrSet('target', '_blank');
      token.attrSet('rel', 'nofollow noopener noreferrer');
    }
  }

  return renderer.renderToken(tokens, idx, options);
};

interface MarkdownContentProps {
  content: string;
}

/**
 * Server-side Markdown renderer for database posts
 * This component uses markdown-it which works in all environments including Edge Runtime
 */
export function MarkdownContent({ content }: MarkdownContentProps) {
  let html = '';
  if (content) {
    const env: MarkdownEnv = {};
    html = md.render(content, env);
  }

  return (
    <div className="markdown-body" dangerouslySetInnerHTML={{ __html: html }} />
  );
}
