import assert from 'node:assert/strict';
import test from 'node:test';

import {
  checkOutboundUrl,
  isCloudMetadataHost,
  isNonPublicHostname,
} from './outbound-url';

test('checkOutboundUrl: 空输入返回 empty', () => {
  assert.deepEqual(checkOutboundUrl('   '), { ok: false, reason: 'empty' });
});

test('checkOutboundUrl: 非法 URL 返回 invalid-url', () => {
  assert.deepEqual(checkOutboundUrl('not a url'), {
    ok: false,
    reason: 'invalid-url',
  });
});

test('checkOutboundUrl: 默认仅允许 https', () => {
  assert.deepEqual(checkOutboundUrl('ftp://example.com'), {
    ok: false,
    reason: 'unsupported-protocol:ftp:',
  });
  assert.deepEqual(checkOutboundUrl('http://example.com'), {
    ok: false,
    reason: 'unsupported-protocol:http:',
  });
});

test('checkOutboundUrl: allowInsecureHttp=true 时允许 http', () => {
  const result = checkOutboundUrl('http://example.com', {
    allowInsecureHttp: true,
  });
  assert.equal(result.ok, true);
  assert.equal(result.url.protocol, 'http:');
  assert.equal(result.url.hostname, 'example.com');
});

test('checkOutboundUrl: 禁止 URL 凭据', () => {
  assert.deepEqual(checkOutboundUrl('https://user:pass@example.com'), {
    ok: false,
    reason: 'credentials-not-allowed',
  });
});

test('checkOutboundUrl: hostname 无点时返回 non-public-host', () => {
  assert.deepEqual(checkOutboundUrl('https://example'), {
    ok: false,
    reason: 'non-public-host',
  });
});

test('checkOutboundUrl: 阻止云厂商 metadata host', () => {
  assert.deepEqual(checkOutboundUrl('https://metadata.google.internal'), {
    ok: false,
    reason: 'cloud-metadata-host',
  });
  assert.deepEqual(checkOutboundUrl('https://169.254.169.254'), {
    ok: false,
    reason: 'cloud-metadata-host',
  });
});

test('checkOutboundUrl: 默认阻止内网/本地主机', () => {
  assert.deepEqual(checkOutboundUrl('https://localhost'), {
    ok: false,
    reason: 'non-public-host',
  });
  assert.deepEqual(checkOutboundUrl('https://127.0.0.1'), {
    ok: false,
    reason: 'non-public-host',
  });
});

test('checkOutboundUrl: allowPrivateNetwork=true 时允许内网/本地主机', () => {
  const localhost = checkOutboundUrl('https://localhost', {
    allowPrivateNetwork: true,
  });
  assert.equal(localhost.ok, true);
  assert.equal(localhost.url.hostname, 'localhost');

  const loopback = checkOutboundUrl('https://127.0.0.1', {
    allowPrivateNetwork: true,
  });
  assert.equal(loopback.ok, true);
  assert.equal(loopback.url.hostname, '127.0.0.1');
});

test('checkOutboundUrl: 公网地址允许通过', () => {
  const result = checkOutboundUrl('https://example.com/path?x=1#y');
  assert.equal(result.ok, true);
  assert.equal(result.url.protocol, 'https:');
  assert.equal(result.url.hostname, 'example.com');
});

test('isNonPublicHostname: 纯空白视为非公网', () => {
  assert.equal(isNonPublicHostname('   '), true);
});

test('isNonPublicHostname: 去除尾随点与大小写归一', () => {
  assert.equal(isNonPublicHostname('  Example.COM.  '), false);
});

test('isNonPublicHostname: localhost / .localhost', () => {
  assert.equal(isNonPublicHostname('localhost'), true);
  assert.equal(isNonPublicHostname('foo.localhost'), true);
});

test('isNonPublicHostname: 无点域名视为非公网', () => {
  assert.equal(isNonPublicHostname('example'), true);
});

test('isNonPublicHostname: 非公网 TLD', () => {
  assert.equal(isNonPublicHostname('example.local'), true);
  assert.equal(isNonPublicHostname('example.internal'), true);
});

test('isNonPublicHostname: IPv4 私网/保留网段', () => {
  assert.equal(isNonPublicHostname('10.0.0.1'), true);
  assert.equal(isNonPublicHostname('127.0.0.1'), true);
  assert.equal(isNonPublicHostname('169.254.1.2'), true);
  assert.equal(isNonPublicHostname('172.16.0.1'), true);
  assert.equal(isNonPublicHostname('172.31.255.255'), true);
  assert.equal(isNonPublicHostname('192.168.0.1'), true);
  assert.equal(isNonPublicHostname('100.64.0.1'), true);
  assert.equal(isNonPublicHostname('198.18.0.1'), true);
  assert.equal(isNonPublicHostname('224.0.0.1'), true);
});

test('isNonPublicHostname: IPv4 公网地址', () => {
  assert.equal(isNonPublicHostname('8.8.8.8'), false);
  assert.equal(isNonPublicHostname('172.32.0.1'), false);
});

test('isNonPublicHostname: IPv6 非公网 (loopback/link-local/ULA/multicast/::)', () => {
  assert.equal(isNonPublicHostname('::'), true);
  assert.equal(isNonPublicHostname('::1'), true);
  assert.equal(isNonPublicHostname('fe80::1'), true);
  assert.equal(isNonPublicHostname('fc00::1'), true);
  assert.equal(isNonPublicHostname('ff00::1'), true);
});

test('isNonPublicHostname: IPv6 公网地址', () => {
  assert.equal(isNonPublicHostname('2001:4860:4860::8888'), false);
});

test('isNonPublicHostname: IPv4-mapped IPv6', () => {
  assert.equal(isNonPublicHostname('::ffff:8.8.8.8'), false);
  assert.equal(isNonPublicHostname('::ffff:10.0.0.1'), true);
  assert.equal(isNonPublicHostname('[::ffff:10.0.0.1]'), true);
});

test('isCloudMetadataHost: 关键 hostname 与 IPv4/IPv4-mapped IPv6', () => {
  assert.equal(isCloudMetadataHost('metadata'), true);
  assert.equal(isCloudMetadataHost('metadata.'), true);
  assert.equal(isCloudMetadataHost('metadata.google.internal'), true);
  assert.equal(isCloudMetadataHost('169.254.169.254'), true);
  assert.equal(isCloudMetadataHost('::ffff:169.254.169.254'), true);

  assert.equal(isCloudMetadataHost('169.254.1.1'), false);
  assert.equal(isCloudMetadataHost('example.com'), false);
  assert.equal(isCloudMetadataHost('  '), false);
});
