type HmacSha256Signer = Pick<SubtleCrypto, 'importKey' | 'sign'>;

export async function signHmacSha256Hex(
  payload: string,
  secret: string,
  subtleCrypto: HmacSha256Signer = crypto.subtle
): Promise<string> {
  const encoder = new TextEncoder();
  const key = await subtleCrypto.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await subtleCrypto.sign(
    'HMAC',
    key,
    encoder.encode(payload)
  );

  return Array.from(new Uint8Array(signature))
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('');
}
