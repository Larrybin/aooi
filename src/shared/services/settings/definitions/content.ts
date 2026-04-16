import type { SettingDefinition } from '../types';

const contentModulesGroup = {
  id: 'content_modules',
  titleKey: 'groups.content_modules',
  description: 'custom your docs and blog module settings',
} as const;

export const contentSettings = [
  {
    name: 'general_docs_enabled',
    title: 'Docs Enabled',
    type: 'switch',
    moduleId: 'docs',
    visibility: 'public',
    value: 'false',
    tip: 'Controls whether the public docs routes and navigation entry are available.',
    group: contentModulesGroup,
    tab: 'content',
  },
  {
    name: 'general_blog_enabled',
    title: 'Blog Enabled',
    type: 'switch',
    moduleId: 'blog',
    visibility: 'public',
    value: 'false',
    tip: 'Controls whether the public blog routes and navigation entry are available.',
    group: contentModulesGroup,
    tab: 'content',
  },
] as const satisfies readonly SettingDefinition[];
