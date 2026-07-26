/**
 * Duplicate billing grant audit (read-only)
 *
 * Usage:
 *   npx tsx scripts/audit-duplicate-billing-grants.ts
 *
 * Why this exists
 * ---------------
 * `updateOrderInTransaction` used to settle orders with an unguarded
 * check-then-insert, so a browser `successUrl` callback racing a provider
 * webhook could grant credits / subscriptions / entitlements for the same order
 * more than once. The race itself is now closed by an advisory lock plus a
 * compare-and-set on the order status (see src/domains/billing/infra/order.ts).
 *
 * Rows created *before* that fix may still be duplicated. Adding the partial
 * unique indexes that would make the database enforce this invariant requires
 * knowing whether such rows exist, so run this first.
 *
 * This script only SELECTs. It never writes, and it never drops anything.
 *
 * Cleaning up duplicates is deliberately NOT automated: each credit grant may
 * already have been partially consumed (see consumed_detail bookkeeping in
 * src/domains/account/infra/credit.ts), so physically deleting rows would leave
 * dangling references. The safe remediation is a compensating update that keeps
 * the earliest row and zeroes the rest — decide that per row with the output
 * below in hand.
 */

import '@/config/load-dotenv';

import postgres from 'postgres';

type DuplicateRow = postgres.Row & { occurrences: string };

const QUERIES: {
  label: string;
  description: string;
  run: (sql: postgres.Sql) => PromiseLike<readonly DuplicateRow[]>;
}[] = [
  {
    label: 'credit.order_no',
    description:
      'credit grants sharing one order_no — each extra row is credits granted twice for a single payment',
    run: (sql) => sql<DuplicateRow[]>`
      select order_no, count(*) as occurrences, min(created_at) as first_seen, max(created_at) as last_seen
      from credit
      where order_no is not null
      group by order_no
      having count(*) > 1
      order by count(*) desc, order_no
    `,
  },
  {
    label: 'subscription.(subscription_id, payment_provider)',
    description:
      'duplicate subscription rows — cancel/renewal events only ever update one of them',
    run: (sql) => sql<DuplicateRow[]>`
      select subscription_id, payment_provider, count(*) as occurrences, min(created_at) as first_seen
      from subscription
      where subscription_id is not null and payment_provider is not null
      group by subscription_id, payment_provider
      having count(*) > 1
      order by count(*) desc
    `,
  },
  {
    label:
      'entitlement_grant.(user_id, site_key, product_key, environment, source, reason)',
    description:
      'duplicate entitlement grants — the six-tuple the code de-duplicates on has no unique index',
    run: (sql) => sql<DuplicateRow[]>`
      select user_id, site_key, product_key, environment, source, reason, count(*) as occurrences
      from entitlement_grant
      group by user_id, site_key, product_key, environment, source, reason
      having count(*) > 1
      order by count(*) desc
    `,
  },
];

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not set');
  }

  const sql = postgres(databaseUrl, {
    prepare: false,
    max: 1,
    idle_timeout: 1,
    connect_timeout: 5,
  });

  let totalDuplicateGroups = 0;

  try {
    for (const query of QUERIES) {
      const rows = await query.run(sql);
      totalDuplicateGroups += rows.length;

      if (rows.length === 0) {
        console.log(`ok   ${query.label}: no duplicates`);
        continue;
      }

      console.log('');
      console.log(`FAIL ${query.label}: ${rows.length} duplicated group(s)`);
      console.log(`     ${query.description}`);
      console.table(rows);
    }
  } finally {
    await sql.end({ timeout: 5 });
  }

  console.log('');
  if (totalDuplicateGroups === 0) {
    console.log(
      'No duplicates found. It is safe to add the partial unique indexes:\n' +
        '  create unique index "uq_credit_order_no" on "credit" ("order_no") where "order_no" is not null;\n' +
        '  create unique index "uq_subscription_provider_ref" on "subscription" ("subscription_id", "payment_provider")\n' +
        '    where "subscription_id" is not null and "payment_provider" is not null;'
    );
    return;
  }

  console.log(
    `Found ${totalDuplicateGroups} duplicated group(s). Do NOT add the unique indexes yet —\n` +
      'the migration would fail. Remediate with a compensating update first (keep the\n' +
      'earliest row, zero the remaining ones); do not delete rows, consumed_detail\n' +
      'references them by credit id.'
  );
  process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error('audit-duplicate-billing-grants failed', error);
  process.exit(1);
});
