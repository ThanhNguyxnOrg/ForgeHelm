// Cryptographic helper functions using the Web Cryptography API (PBKDF2 + AES-GCM)

const PBKDF2_ITERATIONS = 100000;

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

export function generateSalt() {
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);
  return arrayBufferToBase64(salt.buffer);
}

async function getDerivationKey(pin) {
  const encoder = new TextEncoder();
  const pinBytes = encoder.encode(pin);
  
  // Import the raw PIN bytes to use as input to key derivation
  return crypto.subtle.importKey(
    'raw',
    pinBytes,
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );
}

export async function deriveKey(pin, saltBase64) {
  const baseKey = await getDerivationKey(pin);
  const salt = base64ToArrayBuffer(saltBase64);
  
  // Derive an AES-GCM key from the base key using PBKDF2
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256'
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false, // key is not exportable
    ['encrypt', 'decrypt']
  );
}

export async function encrypt(text, key) {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  
  // Initialization Vector (12 bytes for AES-GCM)
  const iv = new Uint8Array(12);
  crypto.getRandomValues(iv);
  
  const ciphertextBuffer = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv
    },
    key,
    data
  );
  
  return {
    ciphertext: arrayBufferToBase64(ciphertextBuffer),
    iv: arrayBufferToBase64(iv.buffer)
  };
}

export async function decrypt(ciphertextBase64, ivBase64, key) {
  const ciphertext = base64ToArrayBuffer(ciphertextBase64);
  const iv = base64ToArrayBuffer(ivBase64);
  
  try {
    const decryptedBuffer = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv
      },
      key,
      ciphertext
    );
    
    const decoder = new TextDecoder();
    return decoder.decode(decryptedBuffer);
  } catch (err) {
    throw new Error('Invalid PIN or decryption failed');
  }
}
