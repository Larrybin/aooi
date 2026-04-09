import 'server-only';

import type { Setting } from '../types';

export const contentSettings: Setting[] = [
  {
    name: 'general_docs_enabled',
    title: 'Docs Enabled',
    type: 'switch',
    value: 'false',
    tip: 'Controls whether the public docs routes and navigation entry are available.',
    group: 'content_modules',
    tab: 'content',
  },
  {
    name: 'general_blog_enabled',
    title: 'Blog Enabled',
    type: 'switch',
    value: 'false',
    tip: 'Controls whether the public blog routes and navigation entry are available.',
    group: 'content_modules',
    tab: 'content',
  },
];
