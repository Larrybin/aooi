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

export function MarkdownContent({ content }: { content: string }) {
  let html = '';
  if (content) {
    const env: MarkdownEnv = {};
    html = md.render(content, env);
  }

  return (
    <div className="markdown-body" dangerouslySetInnerHTML={{ __html: html }} />
  );
}
