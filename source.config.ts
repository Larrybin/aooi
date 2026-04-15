import { defineConfig, defineDocs } from 'fumadocs-mdx/config';

export const docs = defineDocs({
  dir: 'content/docs',
});

export const pages = defineDocs({
  dir: 'content/pages',
});

export const posts = defineDocs({
  dir: 'content/posts',
});

export default defineConfig({
  mdxOptions: {
    rehypeCodeOptions: false,
  },
});
