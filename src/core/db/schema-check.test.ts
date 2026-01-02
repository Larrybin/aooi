import assert from 'node:assert/strict';
import test from 'node:test';

import {
  assertRoleDeletedAtColumnExists,
  isMissingRoleDeletedAtColumnError,
} from './schema-check';

test('isMissingRoleDeletedAtColumnError: pg code=42703 且包含 role.deleted_at does not exist 时返回 true', () => {
  assert.equal(
    isMissingRoleDeletedAtColumnError({
      code: '42703',
      message: 'column "role"."deleted_at" does not exist',
    }),
    true
  );
});

test('isMissingRoleDeletedAtColumnError: 非匹配错误返回 false', () => {
  assert.equal(isMissingRoleDeletedAtColumnError(null), false);
  assert.equal(isMissingRoleDeletedAtColumnError({}), false);
  assert.equal(
    isMissingRoleDeletedAtColumnError({
      code: '42P01',
      message: 'missing table',
    }),
    false
  );
});

test('assertRoleDeletedAtColumnExists: 列存在时不抛错', async () => {
  const sql: Parameters<
    typeof assertRoleDeletedAtColumnExists
  >[0]['sql'] = async () => [{ ok: 1 }];
  const errors: Array<{ message: string; meta?: Record<string, unknown> }> = [];
  const logger = {
    error: (message: string, meta?: Record<string, unknown>) => {
      errors.push({ message, meta });
    },
  };

  await assertRoleDeletedAtColumnExists({ sql, isProduction: false, logger });
  assert.equal(errors.length, 0);
});

test('assertRoleDeletedAtColumnExists: 非生产环境列缺失时抛出详细 hint', async () => {
  const sql: Parameters<
    typeof assertRoleDeletedAtColumnExists
  >[0]['sql'] = async () => [];
  const errors: Array<{ message: string; meta?: Record<string, unknown> }> = [];
  const logger = {
    error: (message: string, meta?: Record<string, unknown>) => {
      errors.push({ message, meta });
    },
  };

  await assert.rejects(
    () => assertRoleDeletedAtColumnExists({ sql, isProduction: false, logger }),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /missing column public\.role\.deleted_at/i);
      assert.match(error.message, /pnpm db:migrate/i);
      return true;
    }
  );

  assert.equal(errors.length, 1);
  assert.equal(errors[0]?.message, 'db: schema mismatch detected');
  assert.equal(errors[0]?.meta?.check, 'schema.role.deleted_at');
});

test('assertRoleDeletedAtColumnExists: 生产环境列缺失时抛出通用 public error', async () => {
  const sql: Parameters<
    typeof assertRoleDeletedAtColumnExists
  >[0]['sql'] = async () => [];
  const logger = { error: () => undefined };

	  await assert.rejects(
	    () => assertRoleDeletedAtColumnExists({ sql, isProduction: true, logger }),
	    (error: unknown) => {
	      assert.ok(error instanceof Error);
	      assert.match(error.message, /^DB_STARTUP_CHECK_FAILED \(schema\):/);
	      return true;
	    }
	  );
	});

test('assertRoleDeletedAtColumnExists: 非生产环境连接失败时抛出详细 hint', async () => {
  const sql: Parameters<
    typeof assertRoleDeletedAtColumnExists
  >[0]['sql'] = async () => {
    throw new Error('boom');
  };
  const errors: Array<{ message: string; meta?: Record<string, unknown> }> = [];
  const logger = {
    error: (message: string, meta?: Record<string, unknown>) => {
      errors.push({ message, meta });
    },
  };

  await assert.rejects(
    () => assertRoleDeletedAtColumnExists({ sql, isProduction: false, logger }),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /Database connectivity check failed/i);
      assert.match(error.message, /Cause: boom/i);
      return true;
    }
  );

  assert.equal(errors.length, 1);
  assert.equal(errors[0]?.message, 'db: connectivity check failed');
  assert.equal(errors[0]?.meta?.check, 'schema.role.deleted_at');
});

test('assertRoleDeletedAtColumnExists: 生产环境连接失败时抛出通用 public error', async () => {
  const sql: Parameters<
    typeof assertRoleDeletedAtColumnExists
  >[0]['sql'] = async () => {
    throw new Error('boom');
  };
  const logger = { error: () => undefined };

	  await assert.rejects(
	    () => assertRoleDeletedAtColumnExists({ sql, isProduction: true, logger }),
	    (error: unknown) => {
	      assert.ok(error instanceof Error);
	      assert.match(
	        error.message,
	        /^DB_STARTUP_CHECK_FAILED \(connectivity\):/
	      );
	      return true;
	    }
	  );
	});
