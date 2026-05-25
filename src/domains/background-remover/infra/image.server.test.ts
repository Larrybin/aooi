import assert from 'node:assert/strict';
import test from 'node:test';
import { PgDialect } from 'drizzle-orm/pg-core';

import { backgroundRemoverImageOwnerCondition } from './image';

test('backgroundRemoverImageOwnerCondition allows same-session guest image fallback for signed-in users', () => {
  const query = new PgDialect().sqlToQuery(
    backgroundRemoverImageOwnerCondition({
      userId: 'user_1',
      anonymousSessionId: 'anon_1',
    })
  );

  assert.match(query.sql, /"background_remover_image"."user_id" = \$1/);
  assert.match(query.sql, /"background_remover_image"."user_id" is null/);
  assert.match(
    query.sql,
    /"background_remover_image"."anonymous_session_id" = \$2/
  );
  assert.deepEqual(query.params, ['user_1', 'anon_1']);
});

test('backgroundRemoverImageOwnerCondition does not expose guest rows when signed-in user has no anonymous session', () => {
  const query = new PgDialect().sqlToQuery(
    backgroundRemoverImageOwnerCondition({
      userId: 'user_1',
      anonymousSessionId: null,
    })
  );

  assert.match(query.sql, /"background_remover_image"."user_id" = \$1/);
  assert.doesNotMatch(query.sql, /anonymous_session_id/);
  assert.deepEqual(query.params, ['user_1']);
});
