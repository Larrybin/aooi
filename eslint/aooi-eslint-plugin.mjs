const HTTP_METHOD_EXPORT_NAMES = new Set([
  'GET',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
  'OPTIONS',
  'HEAD',
]);

function isHttpMethodExportName(name) {
  return HTTP_METHOD_EXPORT_NAMES.has(name);
}

function isIdentifier(node, name) {
  return node?.type === 'Identifier' && node.name === name;
}

function unwrapExpression(node) {
  let current = node;
  while (current) {
    if (
      current.type === 'TSAsExpression' ||
      current.type === 'TSSatisfiesExpression' ||
      current.type === 'TSNonNullExpression' ||
      current.type === 'ChainExpression' ||
      current.type === 'ParenthesizedExpression'
    ) {
      current = current.expression;
      continue;
    }
    return current;
  }
  return current;
}

function isWithApiCallExpression(node) {
  const unwrapped = unwrapExpression(node);
  return (
    unwrapped?.type === 'CallExpression' &&
    unwrapped.callee?.type === 'Identifier' &&
    unwrapped.callee.name === 'withApi'
  );
}

function isWithActionCallExpression(node) {
  const unwrapped = unwrapExpression(node);
  return (
    unwrapped?.type === 'CallExpression' &&
    unwrapped.callee?.type === 'Identifier' &&
    unwrapped.callee.name === 'withAction'
  );
}

function unwrapAwaitExpression(node) {
  const unwrapped = unwrapExpression(node);
  return unwrapped?.type === 'AwaitExpression' ? unwrapped.argument : unwrapped;
}

function functionReturnsWithAction(node) {
  if (!node) return false;

  if (node.type === 'ArrowFunctionExpression' && node.expression) {
    return isWithActionCallExpression(unwrapAwaitExpression(node.body));
  }

  if (node.body?.type !== 'BlockStatement') return false;
  for (const statement of node.body.body) {
    if (statement.type !== 'ReturnStatement') continue;
    if (isWithActionCallExpression(unwrapAwaitExpression(statement.argument))) {
      return true;
    }
  }

  return false;
}

const aooiEslintPlugin = {
  rules: {
    'require-withapi-route-handlers': {
      meta: {
        type: 'problem',
        schema: [],
        messages: {
          requireWithApi:
            'Route Handler 必须通过 `withApi(...)` 封装，以统一错误契约并确保 `x-request-id` 贯穿；请改为 `export const {{name}} = withApi(...)`。',
        },
      },
      create(context) {
        return {
          ExportNamedDeclaration(node) {
            if (node.declaration?.type === 'FunctionDeclaration') {
              const exportName = node.declaration.id?.name;
              if (exportName && isHttpMethodExportName(exportName)) {
                context.report({
                  node: node.declaration.id,
                  messageId: 'requireWithApi',
                  data: { name: exportName },
                });
              }
              return;
            }

            if (node.declaration?.type === 'VariableDeclaration') {
              for (const declarator of node.declaration.declarations) {
                if (declarator.id.type !== 'Identifier') continue;

                const exportName = declarator.id.name;
                if (!isHttpMethodExportName(exportName)) continue;

                if (!isWithApiCallExpression(declarator.init)) {
                  context.report({
                    node: declarator.init ?? declarator.id,
                    messageId: 'requireWithApi',
                    data: { name: exportName },
                  });
                }
              }
              return;
            }

            if (node.specifiers?.length) {
              for (const specifier of node.specifiers) {
                const exportedName = isIdentifier(specifier.exported)
                  ? specifier.exported.name
                  : null;
                if (!exportedName) continue;
                if (!isHttpMethodExportName(exportedName)) continue;

                context.report({
                  node: specifier.exported,
                  messageId: 'requireWithApi',
                  data: { name: exportedName },
                });
              }
            }
          },
        };
      },
    },
    'require-withaction-server-actions': {
      meta: {
        type: 'problem',
        schema: [],
        messages: {
          requireWithAction:
            "Server Action（`'use server'`）的导出函数必须 `return withAction(...)`，以统一错误契约并确保 `requestId` 回传。",
        },
      },
      create(context) {
        let isUseServerModule = false;

        return {
          Program(node) {
            isUseServerModule = node.body.some(
              (statement) =>
                statement.type === 'ExpressionStatement' &&
                statement.directive === 'use server'
            );
          },
          ExportNamedDeclaration(node) {
            if (!isUseServerModule) return;

            if (node.declaration?.type === 'FunctionDeclaration') {
              if (!functionReturnsWithAction(node.declaration)) {
                context.report({
                  node: node.declaration.id ?? node.declaration,
                  messageId: 'requireWithAction',
                });
              }
              return;
            }

            if (node.declaration?.type === 'VariableDeclaration') {
              for (const declarator of node.declaration.declarations) {
                if (declarator.id.type !== 'Identifier') continue;

                const init = declarator.init;
                if (
                  init?.type !== 'ArrowFunctionExpression' &&
                  init?.type !== 'FunctionExpression'
                ) {
                  continue;
                }

                if (!functionReturnsWithAction(init)) {
                  context.report({
                    node: declarator.id,
                    messageId: 'requireWithAction',
                  });
                }
              }
            }
          },
        };
      },
    },
  },
};

export default aooiEslintPlugin;
