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
      name: 'no-shared-to-feature-or-app',
      severity: 'error',
      from: { path: '^src/shared/' },
      to: { path: '^src/(features|app)/' },
    },
    {
      name: 'no-core-to-feature-or-app',
      severity: 'error',
      from: { path: '^src/core/' },
      to: { path: '^src/(features|app)/' },
    },
    {
      name: 'no-features-to-app',
      severity: 'error',
      from: { path: '^src/features/' },
      to: { path: '^src/app/' },
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
        pathNot: '^src/testing/',
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
      to: { path: '^src/(app|surfaces|domains/[^/]+/application)/' },
    },
    {
      name: 'no-shared-to-domains-surfaces-or-infra',
      severity: 'error',
      from: { path: '^src/shared/' },
      to: { path: '^src/(domains|surfaces|infra)/' },
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
