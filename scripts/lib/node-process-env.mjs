const DNS_RESULT_ORDER_IPV4_FIRST = '--dns-result-order=ipv4first';

function tokenizeNodeOptions(value) {
  return String(value || '')
    .split(/\s+/)
    .map((option) => option.trim())
    .filter(Boolean);
}

export function ensureNodeOptionsInclude(
  existingNodeOptions,
  requiredOptions = []
) {
  const options = tokenizeNodeOptions(existingNodeOptions);

  for (const requiredOption of requiredOptions) {
    if (!requiredOption || options.includes(requiredOption)) {
      continue;
    }

    options.unshift(requiredOption);
  }

  return options.join(' ');
}

export function withIpv4FirstNodeOptions(env = process.env) {
  return {
    ...env,
    NODE_OPTIONS: ensureNodeOptionsInclude(env.NODE_OPTIONS, [
      DNS_RESULT_ORDER_IPV4_FIRST,
    ]),
  };
}

export { DNS_RESULT_ORDER_IPV4_FIRST };
