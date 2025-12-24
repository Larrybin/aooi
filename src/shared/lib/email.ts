export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function maskEmail(email: string): string {
  const normalized = normalizeEmail(email);
  const [local, domain] = normalized.split('@');
  if (!domain) return '[email]';

  if (local.length <= 2) {
    const first = local[0] ?? '*';
    return `${first}*@${domain}`;
  }

  return `${local.slice(0, 2)}***@${domain}`;
}
