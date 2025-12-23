export type OutboundUrlPolicy = {
  allowInsecureHttp?: boolean;
  allowPrivateNetwork?: boolean;
};

export type OutboundUrlCheckResult =
  | { ok: true; url: URL }
  | { ok: false; reason: string };

type IpLiteral =
  | { kind: 'ipv4'; bytes: [number, number, number, number] }
  | { kind: 'ipv6'; bytes: Uint8Array };

const NON_PUBLIC_TLDS = new Set([
  'corp',
  'home',
  'internal',
  'intranet',
  'lan',
  'local',
  'localdomain',
]);

export function checkOutboundUrl(
  input: string,
  policy?: OutboundUrlPolicy
): OutboundUrlCheckResult {
  const trimmed = input.trim();
  if (!trimmed) return { ok: false, reason: 'empty' };

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return { ok: false, reason: 'invalid-url' };
  }

  const allowInsecureHttp = policy?.allowInsecureHttp === true;
  const protocol = url.protocol.toLowerCase();
  if (protocol !== 'https:' && !(allowInsecureHttp && protocol === 'http:')) {
    return { ok: false, reason: `unsupported-protocol:${protocol}` };
  }

  if (url.username || url.password) {
    return { ok: false, reason: 'credentials-not-allowed' };
  }

  const hostname = url.hostname.toLowerCase();
  if (!hostname) return { ok: false, reason: 'missing-hostname' };

  if (isCloudMetadataHost(hostname)) {
    return { ok: false, reason: 'cloud-metadata-host' };
  }

  const allowPrivateNetwork = policy?.allowPrivateNetwork === true;
  if (!allowPrivateNetwork && isNonPublicHostname(hostname)) {
    return { ok: false, reason: 'non-public-host' };
  }

  return { ok: true, url };
}

export function isNonPublicHostname(hostname: string): boolean {
  const normalized = hostname.trim().toLowerCase();
  const withoutTrailingDot = normalized.endsWith('.')
    ? normalized.slice(0, -1)
    : normalized;
  if (!withoutTrailingDot) return true;

  const ip = parseIpLiteral(withoutTrailingDot);
  if (ip) {
    return isNonPublicIpLiteral(ip);
  }

  if (withoutTrailingDot === 'localhost') return true;
  if (withoutTrailingDot.endsWith('.localhost')) return true;

  if (!withoutTrailingDot.includes('.')) return true;

  const tld = withoutTrailingDot.split('.').pop();
  if (!tld || NON_PUBLIC_TLDS.has(tld)) return true;

  return false;
}

export function isCloudMetadataHost(hostname: string): boolean {
  const normalized = hostname.trim().toLowerCase();
  const withoutTrailingDot = normalized.endsWith('.')
    ? normalized.slice(0, -1)
    : normalized;
  if (!withoutTrailingDot) return false;

  if (withoutTrailingDot === 'metadata') return true;
  if (withoutTrailingDot === 'metadata.google.internal') return true;

  const ip = parseIpLiteral(withoutTrailingDot);
  if (ip?.kind === 'ipv4') {
    const [a, b, c, d] = ip.bytes;
    return a === 169 && b === 254 && c === 169 && d === 254;
  }
  if (ip?.kind === 'ipv6') {
    const mapped = getIpv4FromMappedIpv6(ip.bytes);
    if (!mapped) return false;
    const [a, b, c, d] = mapped;
    return a === 169 && b === 254 && c === 169 && d === 254;
  }

  return false;
}

function parseIpLiteral(hostname: string): IpLiteral | null {
  const ipv4 = parseIpv4Literal(hostname);
  if (ipv4) return ipv4;
  const ipv6 = parseIpv6Literal(hostname);
  if (ipv6) return ipv6;
  return null;
}

function parseIpv4Literal(hostname: string): IpLiteral | null {
  if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) return null;
  const parts = hostname.split('.').map((value) => Number.parseInt(value, 10));
  if (parts.length !== 4) return null;
  for (const part of parts) {
    if (!Number.isFinite(part) || part < 0 || part > 255) return null;
  }

  return {
    kind: 'ipv4',
    bytes: [parts[0]!, parts[1]!, parts[2]!, parts[3]!],
  };
}

function parseIpv6Literal(hostname: string): IpLiteral | null {
  if (
    !hostname.startsWith('[') ||
    !hostname.endsWith(']') ||
    hostname.length < 4
  ) {
    return null;
  }

  const inside = hostname.slice(1, -1).toLowerCase();
  if (!inside || inside.includes('%')) {
    return null;
  }

  const expanded = expandIpv6(inside);
  if (!expanded) return null;

  const bytes = new Uint8Array(16);
  for (let i = 0; i < 8; i += 1) {
    const value = expanded[i] ?? 0;
    bytes[i * 2] = (value >> 8) & 0xff;
    bytes[i * 2 + 1] = value & 0xff;
  }

  return { kind: 'ipv6', bytes };
}

function expandIpv6(input: string): number[] | null {
  const parts = input.split('::');
  if (parts.length > 2) return null;

  const head = parts[0] ? parts[0].split(':') : [];
  const tail = parts[1] ? parts[1].split(':') : [];

  const headExpanded = expandIpv6Segments(head);
  if (!headExpanded) return null;

  const tailExpanded = expandIpv6Segments(tail);
  if (!tailExpanded) return null;

  const total = headExpanded.length + tailExpanded.length;
  if (parts.length === 1) {
    return total === 8 ? headExpanded : null;
  }

  if (total > 8) return null;
  const zeros = new Array<number>(8 - total).fill(0);
  return [...headExpanded, ...zeros, ...tailExpanded];
}

function expandIpv6Segments(segments: string[]): number[] | null {
  if (segments.length === 0) return [];

  const expanded: number[] = [];
  for (const segment of segments) {
    if (!segment) return null;

    if (segment.includes('.')) {
      const ipv4 = parseIpv4Embedded(segment);
      if (!ipv4) return null;
      expanded.push(((ipv4[0] << 8) | ipv4[1]) & 0xffff);
      expanded.push(((ipv4[2] << 8) | ipv4[3]) & 0xffff);
      continue;
    }

    if (!/^[0-9a-f]{1,4}$/.test(segment)) return null;
    const value = Number.parseInt(segment, 16);
    if (!Number.isFinite(value) || value < 0 || value > 0xffff) return null;
    expanded.push(value);
  }

  return expanded;
}

function parseIpv4Embedded(
  input: string
): [number, number, number, number] | null {
  if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(input)) return null;
  const parts = input.split('.').map((value) => Number.parseInt(value, 10));
  if (parts.length !== 4) return null;
  for (const part of parts) {
    if (!Number.isFinite(part) || part < 0 || part > 255) return null;
  }
  return [parts[0]!, parts[1]!, parts[2]!, parts[3]!];
}

function isNonPublicIpLiteral(ip: IpLiteral): boolean {
  if (ip.kind === 'ipv4') {
    const [a, b] = ip.bytes;

    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    if (a === 198 && (b === 18 || b === 19)) return true;
    if (a >= 224) return true;

    return false;
  }

  const bytes = ip.bytes;
  if (isAllZero(bytes)) return true;
  if (isLoopbackV6(bytes)) return true;
  if (isLinkLocalV6(bytes)) return true;
  if (isUniqueLocalV6(bytes)) return true;
  if (isMulticastV6(bytes)) return true;

  const mapped = getIpv4FromMappedIpv6(bytes);
  if (mapped) {
    return isNonPublicIpLiteral({ kind: 'ipv4', bytes: mapped });
  }

  return false;
}

function isAllZero(bytes: Uint8Array): boolean {
  for (const value of bytes) {
    if (value !== 0) return false;
  }
  return true;
}

function isLoopbackV6(bytes: Uint8Array): boolean {
  for (let i = 0; i < 15; i += 1) {
    if (bytes[i] !== 0) return false;
  }
  return bytes[15] === 1;
}

function isLinkLocalV6(bytes: Uint8Array): boolean {
  return bytes[0] === 0xfe && (bytes[1]! & 0xc0) === 0x80;
}

function isUniqueLocalV6(bytes: Uint8Array): boolean {
  return (bytes[0]! & 0xfe) === 0xfc;
}

function isMulticastV6(bytes: Uint8Array): boolean {
  return bytes[0] === 0xff;
}

function getIpv4FromMappedIpv6(
  bytes: Uint8Array
): [number, number, number, number] | null {
  if (bytes.length !== 16) return null;

  for (let i = 0; i < 10; i += 1) {
    if (bytes[i] !== 0) return null;
  }
  if (bytes[10] !== 0xff || bytes[11] !== 0xff) return null;

  return [bytes[12]!, bytes[13]!, bytes[14]!, bytes[15]!];
}
