import type { SettingDefinition } from '../types';
import { defineSettingsGroup } from './builder';

const contentModulesGroup = {
  id: 'content_modules',
  titleKey: 'groups.content_modules',
  description: 'custom your docs and blog module settings',
} as const;

const docsModuleSettings = defineSettingsGroup(
  {
    moduleId: 'docs',
    tab: 'content',
    group: contentModulesGroup,
    defaultVisibility: 'public',
  },
  [
    {
      name: 'general_docs_enabled',
      title: 'Docs Enabled',
      type: 'switch',
      value: 'false',
      tip: 'Controls whether the public docs routes and navigation entry are available.',
    },
  ] as const
);

const blogModuleSettings = defineSettingsGroup(
  {
    moduleId: 'blog',
    tab: 'content',
    group: contentModulesGroup,
    defaultVisibility: 'public',
  },
  [
    {
      name: 'general_blog_enabled',
      title: 'Blog Enabled',
      type: 'switch',
      value: 'false',
      tip: 'Controls whether the public blog routes and navigation entry are available.',
    },
  ] as const
);

export const contentSettings = [
  ...docsModuleSettings,
  ...blogModuleSettings,
] as const satisfies readonly SettingDefinition[];
