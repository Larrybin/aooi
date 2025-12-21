import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';

const baseNoRestrictedImports = {
  paths: [
    {
      name: '@/shared/services/rbac_guard',
      importNames: ['PERMISSIONS'],
      message:
        "请从 '@/shared/constants/rbac-permissions' 导入 PERMISSIONS，以避免仅取常量却引入 server-only guard 依赖。",
    },
    {
      name: '@/core/db/config',
      message:
        "禁止在运行时代码中导入 '@/core/db/config'（仅用于 drizzle-kit CLI 配置）。",
    },
    {
      name: '@/config/load-dotenv',
      message:
        "禁止在运行时代码中导入 '@/config/load-dotenv'（仅用于 scripts/CLI 加载本地 .env*）。",
    },
  ],
};

const clientSurfaceNoRestrictedImports = {
  ...baseNoRestrictedImports,
  paths: [
    ...baseNoRestrictedImports.paths,
    {
      name: 'next/headers',
      message: "Client 模块禁止导入 'next/headers'（仅 Server 侧可用）。",
    },
    {
      name: 'server-only',
      message:
        "Client 模块禁止导入 'server-only'（该标记仅用于 server-only 模块）。",
    },
  ],
  patterns: [
    {
      group: ['@/core/db', '@/core/db/**'],
      allowTypeImports: true,
      message:
        "Client 模块禁止导入 '@/core/db/**'（DB 访问必须保持 server-only）。",
    },
    {
      group: ['@/shared/services/**'],
      allowTypeImports: true,
      message:
        "Client 模块禁止导入 '@/shared/services/**'（请在 Server Component / Route Handler 中编排，再通过 props 传入数据）。",
    },
    {
      group: ['@/shared/content/**'],
      allowTypeImports: true,
      message:
        "Client 模块禁止导入 '@/shared/content/**'（content pipeline 必须保持 server-only）。",
    },
    {
      regex: '\\.server(\\.|$)',
      allowTypeImports: true,
      message:
        "Client 模块禁止导入 '*.server'（请改为依赖 DTO/类型，或在 Server 侧调用后传入）。",
    },
  ],
};

const serverEntryNoRestrictedClientOnlyImports = {
  ...baseNoRestrictedImports,
  paths: [
    ...baseNoRestrictedImports.paths,
    {
      name: 'client-only',
      message:
        "Server 模块禁止导入 'client-only'（该包仅用于标记 client-only 模块）。",
    },
    {
      name: '@/shared/lib/api/client',
      message:
        "Server 模块禁止导入 '@/shared/lib/api/client'（这是 client-side fetch 封装）。",
    },
  ],
  patterns: [
    {
      regex: '\\.client(\\.|$)',
      allowTypeImports: true,
      message:
        "Server 模块禁止导入 '*.client'（client-only 代码请通过组件边界或 props 传入）。",
    },
    {
      group: ['@/**/client/**'],
      allowTypeImports: true,
      message:
        "Server 模块禁止导入 '**/client/**'（client-only 代码请通过组件边界或 props 传入）。",
    },
  ],
};

const eslintConfig = [
  {
    ignores: [
      '**/.next/**',
      '**/node_modules/**',
      '**/.source/**',
      'temp/**',
      'raphael-starterkit-v1-main/**',
    ],
  },
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    files: [
      'src/app/api/**/*.{ts,tsx}',
      'src/core/**/*.{ts,tsx}',
      'src/extensions/**/*.{ts,tsx}',
      'src/shared/lib/api/**/*.{ts,tsx}',
      'src/shared/models/**/*.{ts,tsx}',
      'src/shared/services/**/*.{ts,tsx}',
    ],
    rules: {
      'no-console': 'error',
    },
  },
  {
    files: ['**/*.{ts,tsx,mts,cts}'],
    rules: {
      'no-restricted-imports': ['error', baseNoRestrictedImports],
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          args: 'after-used',
          argsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          ignoreRestSiblings: true,
          varsIgnorePattern: '^_',
        },
      ],
    },
  },
  {
    files: ['scripts/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          ...baseNoRestrictedImports,
          paths: baseNoRestrictedImports.paths.filter(
            (rule) => rule.name !== '@/config/load-dotenv'
          ),
        },
      ],
    },
  },
  {
    files: ['src/shared/types/**/*.{ts,tsx,d.ts}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          ...baseNoRestrictedImports,
          patterns: [
            {
              group: ['@/core/**'],
              message:
                '请避免在 shared/types 中依赖 core（类型层反向依赖会放大耦合）。建议将类型下沉到 shared/types 或改为直接依赖三方 type。',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/shared/types/blocks/**/*.d.ts'],
    rules: {
      '@typescript-eslint/no-empty-object-type': [
        'error',
        { allowInterfaces: 'with-single-extends' },
      ],
    },
  },
  {
    files: ['src/shared/models/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          ...baseNoRestrictedImports,
          paths: [
            ...baseNoRestrictedImports.paths,
            {
              name: 'react',
              message:
                "请避免在 shared/models 中依赖 'react'（models 仅承载数据访问与形态转换）。",
            },
            {
              name: 'react-dom',
              message:
                "请避免在 shared/models 中依赖 'react-dom'（models 仅承载数据访问与形态转换）。",
            },
          ],
          patterns: [
            {
              group: ['next/**'],
              message:
                '请避免在 shared/models 中依赖 next/**（建议将请求/headers/navigation 等边界下沉到 shared/lib 的 *.server 模块或由 services 编排）。',
            },
            {
              group: ['@/shared/blocks/**', '@/shared/components/**'],
              message:
                '请避免在 shared/models 中依赖 UI 层（blocks/components），以保持 DAL/模型层低耦合与可复用性。',
            },
            {
              regex: '^@/core/(?!db($|/)).*',
              message:
                "shared/models 仅允许依赖 '@/core/db'；其它 core 依赖会放大耦合面。",
            },
            {
              group: ['@/core/docs/**', '@/mdx-components'],
              message:
                '请避免在 shared/models 中引入 docs/mdx 体系（建议拆分为 repo 与 content pipeline 层）。',
            },
            {
              group: ['@/core/auth', '@/core/auth/**'],
              message:
                '请避免在 shared/models 中依赖 core/auth。建议将会话获取下沉到 shared/lib 的 server-only 边界，再由 models 调用该边界或由 services 负责编排。',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/shared/services/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          ...baseNoRestrictedImports,
          patterns: [
            {
              group: [
                '@/shared/blocks/**',
                '@/shared/components/**',
                '@/shared/contexts/**',
                '@/shared/hooks/**',
                '@/themes/**',
              ],
              message:
                '请避免在 shared/services 中依赖 UI 层（blocks/components/contexts/hooks/themes）；services 应只返回结构化数据（DTO）。',
            },
            {
              regex: '^\\.{1,2}/.*(/|^)app/',
              message:
                '请避免在 shared/services 中通过相对路径依赖 src/app/**（入口层不应被服务层反向依赖）。',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/shared/constants/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          ...baseNoRestrictedImports,
          patterns: [
            {
              group: ['@/shared/services/**'],
              allowTypeImports: true,
              message:
                "shared/constants 禁止依赖 '@/shared/services/**'（常量层必须保持叶子层）。",
            },
            {
              group: ['@/shared/models/**'],
              allowTypeImports: true,
              message:
                "shared/constants 禁止依赖 '@/shared/models/**'（常量层必须保持叶子层）。",
            },
            {
              group: ['@/core/**'],
              allowTypeImports: true,
              message:
                "shared/constants 禁止依赖 '@/core/**'（常量层必须保持叶子层）。",
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/shared/content/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          ...baseNoRestrictedImports,
          paths: [
            ...baseNoRestrictedImports.paths,
            {
              name: 'client-only',
              message:
                "shared/content 禁止导入 'client-only'（content pipeline 必须保持 server-only）。",
            },
            {
              name: '@/shared/lib/api/client',
              message:
                "shared/content 禁止导入 '@/shared/lib/api/client'（该模块为 client-only）。",
            },
          ],
          patterns: [
            {
              group: [
                '@/shared/blocks/**',
                '@/shared/components/**',
                '@/shared/contexts/**',
                '@/shared/hooks/**',
                '@/themes/**',
              ],
              message:
                'shared/content 禁止依赖 UI/client 层（blocks/components/contexts/hooks/themes）。',
            },
            {
              regex: '\\.client(\\.|$)',
              allowTypeImports: true,
              message:
                "shared/content 禁止导入 '*.client'（client-only 模块）。",
            },
            {
              group: ['@/**/client/**'],
              allowTypeImports: true,
              message:
                "shared/content 禁止导入 '**/client/**'（client-only 模块）。",
            },
          ],
        },
      ],
    },
  },
  {
    files: [
      'src/shared/blocks/**/*.{ts,tsx}',
      'src/shared/components/**/*.{ts,tsx}',
      'src/shared/contexts/**/*.{ts,tsx}',
      'src/shared/hooks/**/*.{ts,tsx}',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          ...clientSurfaceNoRestrictedImports,
          patterns: [
            {
              regex: '^@/core/(?!i18n/navigation$|auth/client$).*',
              message:
                "shared UI 层仅允许依赖 '@/core/i18n/navigation' 与 '@/core/auth/client'；其它 core 依赖会扩大耦合面。",
            },
            ...(clientSurfaceNoRestrictedImports.patterns || []),
          ],
        },
      ],
    },
  },
  {
    files: ['src/themes/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          ...clientSurfaceNoRestrictedImports,
          patterns: [
            {
              regex: '^@/core/(?!i18n/navigation$|auth/client$).*',
              message:
                "themes UI 层仅允许依赖 '@/core/i18n/navigation' 与 '@/core/auth/client'；其它 core 依赖会扩大耦合面。",
            },
            ...(clientSurfaceNoRestrictedImports.patterns || []),
          ],
        },
      ],
      'react-hooks/immutability': 'off',
      'react-hooks/set-state-in-effect': 'off',
    },
  },
  {
    files: [
      'src/**/*.client.{ts,tsx}',
      'src/**/client/**/*.{ts,tsx}',
      'src/app/**/error.tsx',
      'src/app/**/global-error.tsx',
      'src/shared/lib/api/client.ts',
      'src/core/theme/provider.tsx',
    ],
    rules: {
      'no-restricted-imports': ['error', clientSurfaceNoRestrictedImports],
    },
  },
  {
    files: ['src/app/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        serverEntryNoRestrictedClientOnlyImports,
      ],
    },
  },
  {
    files: ['src/app/**/route.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          ...serverEntryNoRestrictedClientOnlyImports,
          patterns: [
            ...(serverEntryNoRestrictedClientOnlyImports.patterns || []),
            {
              group: [
                '@/shared/blocks/**',
                '@/shared/components/**',
                '@/shared/contexts/**',
                '@/themes/**',
              ],
              message:
                'Route Handler 禁止依赖 UI 层（blocks/components/contexts/themes）；请将渲染/模板生成下沉到 shared/lib 或 shared/content。',
            },
          ],
        },
      ],
    },
  },
];

export default eslintConfig;
