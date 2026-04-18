import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(currentDir, '../../../..');

async function readRepoFile(relativePath: string) {
  return readFile(path.resolve(repoRoot, relativePath), 'utf8');
}

test('PromptInput: 不再暴露 provider 双模式入口', async () => {
  const barrel = await readRepoFile('src/shared/components/ai-elements/prompt-input.tsx');
  const form = await readRepoFile(
    'src/shared/components/ai-elements/prompt-input/form.tsx'
  );
  const textarea = await readRepoFile(
    'src/shared/components/ai-elements/prompt-input/textarea.tsx'
  );
  const attachments = await readRepoFile(
    'src/shared/components/ai-elements/prompt-input/attachments.tsx'
  );

  assert.equal(
    barrel.includes('./prompt-input/controller'),
    false,
    'barrel should not export controller layer'
  );
  assert.equal(
    form.includes('useOptionalPromptInputController'),
    false,
    'PromptInput should only use local attachment state'
  );
  assert.equal(
    textarea.includes('useOptionalPromptInputController'),
    false,
    'PromptInputTextarea should not read provider controller'
  );
  assert.equal(
    attachments.includes('useOptionalProviderAttachments'),
    false,
    'attachments should only read local context'
  );
});

test('PromptInput: 已删除旧 provider 文件', async () => {
  await assert.rejects(() =>
    access(
      path.resolve(
        repoRoot,
        'src/shared/components/ai-elements/prompt-input/controller.tsx'
      )
    )
  );
  await assert.rejects(() =>
    access(
      path.resolve(
        repoRoot,
        'src/shared/components/ai-elements/prompt-input/internal.tsx'
      )
    )
  );
});
