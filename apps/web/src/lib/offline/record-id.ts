const ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz";

/**
 * A new record id made on the device, in the cuid shape the API accepts
 * ("c" plus 24 lowercase letters and digits). Uses getRandomValues because
 * randomUUID needs a secure context.
 */
export function createRecordId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  let id = "c";
  for (const byte of bytes) id += ALPHABET[byte % ALPHABET.length];
  return id;
}
