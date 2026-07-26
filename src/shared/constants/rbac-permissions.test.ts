import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import test from 'node:test';

import {
  PERMISSIONS,
  RESERVED_UNENFORCED_PERMISSIONS,
} from './rbac-permissions';

/**
 * A permission code is only worth anything if some code path actually checks it.
 * Seeding a code and granting it to a role, while no guard ever consults it,
 * produces a role that reads as restricted or capable when it is neither.
 *
 * This asserts the invariant in both directions so neither side can rot: a code
 * that loses its last enforcement point fails here, and a reserved code that
 * gains one has to be taken off the reserved list.
 */

const CONSTANT_NAMES = Object.keys(PERMISSIONS) as Array<
  keyof typeof PERMISSIONS
>;

function findEnforcementPoints(constantName: string): string[] {
  // Enforcement always goes through the PERMISSIONS constant rather than the raw
  // string, so searching for the member expression is both precise and cheap.
  // Definition, tests and the RBAC seeding script are not enforcement.
  try {
    const stdout = execFileSync(
      'git',
      [
        'grep',
        '-l',
        '--',
        `PERMISSIONS.${constantName}`,
        'src',
        'cloudflare',
        'scripts',
      ],
      { encoding: 'utf8' }
    );

    return stdout
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .filter(
        (file) =>
          !file.includes('rbac-permissions') &&
          !file.includes('init-rbac') &&
          !/\.(test|spec)\.tsx?$/.test(file)
      );
  } catch {
    // git grep exits non-zero when there are no matches.
    return [];
  }
}

test('每个权限码要么有强制点，要么被显式登记为保留未启用', () => {
  const reserved = new Set(RESERVED_UNENFORCED_PERMISSIONS);
  const unenforcedAndUndeclared: string[] = [];

  for (const name of CONSTANT_NAMES) {
    const code = PERMISSIONS[name];
    if (reserved.has(code)) continue;
    if (findEnforcementPoints(name).length === 0) {
      unenforcedAndUndeclared.push(`${name} (${code})`);
    }
  }

  assert.deepEqual(
    unenforcedAndUndeclared,
    [],
    '这些权限码没有任何强制点。要么加上守卫，要么加入 RESERVED_UNENFORCED_PERMISSIONS 并说明原因'
  );
});

test('保留清单里不应出现已经有强制点的权限码', () => {
  const codeToName = new Map(
    CONSTANT_NAMES.map((name) => [PERMISSIONS[name], name])
  );
  const nowEnforced: string[] = [];

  for (const code of RESERVED_UNENFORCED_PERMISSIONS) {
    const name = codeToName.get(code);
    assert.ok(name, `RESERVED_UNENFORCED_PERMISSIONS 含未知权限码: ${code}`);
    if (findEnforcementPoints(name).length > 0) {
      nowEnforced.push(`${name} (${code})`);
    }
  }

  assert.deepEqual(
    nowEnforced,
    [],
    '这些权限码已经被强制了，请从 RESERVED_UNENFORCED_PERMISSIONS 移除'
  );
});
