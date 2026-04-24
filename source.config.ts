import path from 'node:path';

import { z } from 'zod';
import {
  defineConfig,
  defineDocs,
  frontmatterSchema,
} from 'fumadocs-mdx/config';

const DEFAULT_SITE_KEY = 'dev-local';
const siteKey = process.env.SITE?.trim() || DEFAULT_SITE_KEY;
const rootDir = process.cwd();
const contentRoot = path.resolve(rootDir, 'sites', siteKey, 'content');

const requiredCollectionDirs = ['docs', 'pages', 'posts'];

for (const collection of requiredCollectionDirs) {
  const collectionPath = path.resolve(contentRoot, collection);
  try {
    const stat = await import('node:fs/promises').then((fs) => fs.stat(collectionPath));
    if (!stat.isDirectory()) {
      throw new Error(`site content path is not a directory: sites/${siteKey}/content/${collection}`);
    }
  } catch {
    throw new Error(`site content directory is required: sites/${siteKey}/content/${collection}`);
  }
}

const docsFrontmatterSchema = frontmatterSchema.extend({
  title: z.string().min(1),
  description: z.string().optional(),
});

const pageFrontmatterSchema = docsFrontmatterSchema.extend({
  created_at: z.string().optional(),
});

const postFrontmatterSchema = docsFrontmatterSchema.extend({
  created_at: z.string().optional(),
  author_name: z.string().optional(),
  author_image: z.string().optional(),
  image: z.string().optional(),
});

export const docs = defineDocs({
  dir: path.join('sites', siteKey, 'content', 'docs'),
  docs: {
    schema: docsFrontmatterSchema,
  },
});

export const pages = defineDocs({
  dir: path.join('sites', siteKey, 'content', 'pages'),
  docs: {
    schema: pageFrontmatterSchema,
  },
});

export const posts = defineDocs({
  dir: path.join('sites', siteKey, 'content', 'posts'),
  docs: {
    schema: postFrontmatterSchema,
  },
});

export default defineConfig({
  mdxOptions: {
    rehypeCodeOptions: false,
  },
});
