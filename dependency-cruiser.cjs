/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
    {
      name: 'no-import-legacy-architecture-paths',
      severity: 'error',
      from: {},
      to: { path: '^src/(core|features|shared/(models|services))/' },
    },
    {
      name: 'no-runtime-to-scripts-or-tests',
      severity: 'error',
      from: {
        path: '^(src/|cloudflare/)',
        pathNot: '^src/testing/',
      },
      to: { path: '^(scripts/|tests/)' },
    },
    {
      name: 'no-scripts-to-tests',
      severity: 'error',
      from: { path: '^scripts/' },
      to: { path: '^tests/' },
    },
    {
      name: 'no-prod-to-testing',
      severity: 'error',
      from: {
        path: '^(src/|cloudflare/)',
        pathNot: '^src/testing/|^src/architecture-boundaries\\.test\\.ts$',
      },
      to: { path: '^src/testing/' },
    },
    {
      name: 'no-surfaces-to-infra-adapters',
      severity: 'error',
      from: { path: '^src/surfaces/' },
      to: { path: '^src/infra/adapters/' },
    },
    {
      name: 'no-domain-domain-to-app-surfaces-adapters-or-api-schemas',
      severity: 'error',
      from: { path: '^src/domains/[^/]+/domain/' },
      to: {
        path: '^src/(app|surfaces|infra/adapters|shared/schemas/api)/',
      },
    },
    {
      name: 'no-infra-to-app-surfaces-or-domain-application',
      severity: 'error',
      from: { path: '^src/infra/' },
      to: {
        path: '^src/(app|surfaces|domains/[^/]+/application)/',
        pathNot: '^src/domains/settings/application/[^/]+\\.query\\.ts$',
      },
    },
    {
      name: 'no-shared-to-domains-surfaces-or-infra',
      severity: 'error',
      from: {
        path: '^src/shared/',
        pathNot:
          '^src/shared/lib/(auth-session\\.server|config-consistency|runtime/env\\.server|i18n/scoped-intl-provider)\\.tsx?$|^src/shared/(blocks|components|contexts|hooks)/',
      },
      to: {
        path: '^src/(domains|surfaces|infra)/',
        pathNot:
          '^src/domains/settings/application/(settings-store|public-config\\.view)\\.ts$|^src/infra/runtime/env\\.server\\.ts$|^src/infra/platform/logging/',
      },
    },
    {
      name: 'no-shared-ui-to-business-domains-or-adapters',
      severity: 'error',
      from: { path: '^src/shared/(blocks|components|contexts|hooks)/' },
      to: { path: '^src/(domains|infra/adapters|surfaces)/' },
    },
  ],
  options: {
    doNotFollow: {
      path: 'node_modules',
    },
    exclude:
      '(^node_modules)|(^\\.next)|(^\\.open-next)|(^dist)|(^build)|(^output)|(^\\.tmp)|(^src/shared/types/cloudflare\\.d\\.ts$)',
    tsPreCompilationDeps: true,
    tsConfig: {
      fileName: 'tsconfig.json',
    },
    enhancedResolveOptions: {
      extensions: ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json'],
      conditionNames: ['import', 'require', 'node', 'default'],
      mainFields: ['types', 'typings', 'module', 'main'],
    },
  },
};
