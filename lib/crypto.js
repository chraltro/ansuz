/**
 * Simple client-side encryption for API keys
 * Uses AES-GCM with a shared key across all Norrøn apps
 *
 * NOTE: This is security by obscurity. The encryption key is in the source code,
 * so anyone with access to the code can decrypt. This prevents casual viewing
 * of keys in gists, but is NOT secure against determined attackers.
 */

// Shared encryption key for all Norrøn apps
// This is visible in source code - it's for obscurity, not true security
const ENCRYPTION_KEY_MATERIAL = 'norron-apps-2024-key-encryption-v1';

/**
 * Derive an encryption key from the key material
 * @returns {Promise<CryptoKey>}
 */
async function getEncryptionKey() {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(ENCRYPTION_KEY_MATERIAL),
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: encoder.encode('norron-salt'),
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt a string
 * @param {string} plaintext
 * @returns {Promise<string>} Base64-encoded encrypted data with IV
 */
export async function encrypt(plaintext) {
  const encoder = new TextEncoder();
  const key = await getEncryptionKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(plaintext)
  );

  // Combine IV and encrypted data, then base64 encode
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);

  return btoa(String.fromCharCode(...combined));
}

/**
 * Decrypt a string
 * @param {string} ciphertext - Base64-encoded encrypted data with IV
 * @returns {Promise<string>}
 */
export async function decrypt(ciphertext) {
  const decoder = new TextDecoder();
  const key = await getEncryptionKey();

  // Decode base64
  const combined = Uint8Array.from(atob(ciphertext), c => c.charCodeAt(0));

  // Extract IV and encrypted data
  const iv = combined.slice(0, 12);
  const encrypted = combined.slice(12);

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    encrypted
  );

  return decoder.decode(decrypted);
}
