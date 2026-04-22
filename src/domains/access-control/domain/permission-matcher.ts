export function buildPermissionMatchCandidates(
  requiredPermissionCode: string
): string[] {
  const out: string[] = ['*', requiredPermissionCode];
  const parts = requiredPermissionCode.split('.');
  for (let i = parts.length - 1; i > 0; i--) {
    out.push(`${parts.slice(0, i).join('.')}.*`);
  }
  return Array.from(new Set(out));
}

export function matchesPermissionCode(
  userPermissionCodes: ReadonlySet<string>,
  requiredPermissionCode: string
): boolean {
  if (userPermissionCodes.has('*')) {
    return true;
  }

  if (userPermissionCodes.has(requiredPermissionCode)) {
    return true;
  }

  const parts = requiredPermissionCode.split('.');
  for (let i = parts.length - 1; i > 0; i--) {
    const wildcard = `${parts.slice(0, i).join('.')}.*`;
    if (userPermissionCodes.has(wildcard)) {
      return true;
    }
  }

  return false;
}
