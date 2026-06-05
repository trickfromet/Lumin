// Helper to convert hex string to Uint8Array
function hexToUint8Array(hex: string): Uint8Array {
  const arr = new Uint8Array(hex.length / 2);
  for (let i = 0; i < arr.length; i++) {
    arr[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return arr;
}

// Helper to convert base64 to Uint8Array
function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

// Helper to convert Uint8Array to base64
function uint8ArrayToBase64(arr: Uint8Array): string {
  let binary = "";
  const len = arr.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(arr[i]);
  }
  return btoa(binary);
}

async function getCryptoKey(): Promise<CryptoKey> {
  const keyHex = process.env.POST_ENCRYPTION_KEY;
  if (!keyHex || keyHex.length !== 64) {
    throw new Error("POST_ENCRYPTION_KEY must be a 64-character hex string (32 bytes)");
  }
  const keyData = hexToUint8Array(keyHex);
  return globalThis.crypto.subtle.importKey(
    "raw",
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    keyData as any,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encryptContent(plaintext: string): Promise<{
  encrypted: string;
  iv: string;
  authTag: string;
}> {
  const key = await getCryptoKey();
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const encodedPlaintext = new TextEncoder().encode(plaintext);

  const encryptedBuffer = await globalThis.crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: iv,
      tagLength: 128, // 16 bytes auth tag
    },
    key,
    encodedPlaintext
  );

  const encryptedBytes = new Uint8Array(encryptedBuffer);
  // Web Crypto AES-GCM appends the 16-byte auth tag at the end of the encrypted buffer.
  const ciphertextBytes = encryptedBytes.slice(0, encryptedBytes.length - 16);
  const authTagBytes = encryptedBytes.slice(encryptedBytes.length - 16);

  return {
    encrypted: uint8ArrayToBase64(ciphertextBytes),
    iv: uint8ArrayToBase64(iv),
    authTag: uint8ArrayToBase64(authTagBytes),
  };
}

export async function decryptContent(
  encrypted: string,
  iv: string,
  authTag: string
): Promise<string> {
  const key = await getCryptoKey();
  const ciphertextBytes = base64ToUint8Array(encrypted);
  const ivBytes = base64ToUint8Array(iv);
  const authTagBytes = base64ToUint8Array(authTag);

  // Reconstruct the combined buffer (ciphertext + authTag) for Web Crypto
  const combinedBytes = new Uint8Array(ciphertextBytes.length + authTagBytes.length);
  combinedBytes.set(ciphertextBytes);
  combinedBytes.set(authTagBytes, ciphertextBytes.length);

  const decryptedBuffer = await globalThis.crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      iv: ivBytes as any,
      tagLength: 128,
    },
    key,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    combinedBytes as any
  );

  return new TextDecoder().decode(decryptedBuffer);
}
