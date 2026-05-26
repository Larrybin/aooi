import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildPreviewDeploySettingsJson,
  buildPreviewResourceNames,
  isValidHyperdriveId,
  parseHyperdriveIdFromOutput,
  r2BucketListHasName,
} from '../../scripts/site-preview.mjs';

test('site preview resource names are derived from site key and workers.dev subdomain', () => {
  assert.deepEqual(
    buildPreviewResourceNames('background-remover', {
      CF_WORKERS_DEV_SUBDOMAIN: 'aooi-preview',
    }),
    {
      cacheBucket: 'aooi-background-remover-preview-opennext-cache',
      routerOrigin:
        'https://aooi-background-remover-preview-router.aooi-preview.workers.dev',
      routerWorker: 'aooi-background-remover-preview-router',
      storageBucket: 'aooi-background-remover-preview-storage',
    }
  );
});

test('site preview bucket detection matches exact R2 bucket names', () => {
  const output = `
[
  { name: 'aooi-background-remover-preview-opennext-cache' },
  { name: 'aooi-background-remover-preview-storage-extra' }
]
`;

  assert.equal(
    r2BucketListHasName(
      output,
      'aooi-background-remover-preview-opennext-cache'
    ),
    true
  );
  assert.equal(
    r2BucketListHasName(output, 'aooi-background-remover-preview-storage'),
    false
  );
});

test('site preview Hyperdrive id parser reads Wrangler output', () => {
  assert.equal(
    parseHyperdriveIdFromOutput(
      'Created Hyperdrive config\nid: 0123456789abcdef0123456789abcdef\n'
    ),
    '0123456789abcdef0123456789abcdef'
  );
  assert.equal(
    parseHyperdriveIdFromOutput(
      'Created 0123456789abcdef0123456789abcdef successfully'
    ),
    '0123456789abcdef0123456789abcdef'
  );
  assert.equal(parseHyperdriveIdFromOutput('Created without id'), '');
});

test('site preview deploy settings JSON stays narrow', () => {
  assert.equal(isValidHyperdriveId('0123456789abcdef0123456789abcdef'), true);
  assert.equal(
    isValidHyperdriveId('replace_with_preview_hyperdrive_id'),
    false
  );
  assert.equal(
    buildPreviewDeploySettingsJson('0123456789abcdef0123456789abcdef'),
    `{
  "configVersion": 1,
  "resources": {
    "hyperdriveId": "0123456789abcdef0123456789abcdef"
  }
}
`
  );
  assert.throws(
    () => buildPreviewDeploySettingsJson('replace_with_preview_hyperdrive_id'),
    /preview Hyperdrive id/
  );
});
