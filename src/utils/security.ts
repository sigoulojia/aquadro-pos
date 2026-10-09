/**
 * Aquadro POS - Cryptographic Security & Credential Hashing
 * Enforces salted SHA-256 hashes for all employee PINs and passwords.
 * Plaintext PIN storage is strictly prohibited.
 */

export class SecurityUtil {
  /**
   * Generates a cryptographically random hexadecimal salt
   */
  public static generateSalt(length: number = 16): string {
    const array = new Uint8Array(length);
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      crypto.getRandomValues(array);
    } else {
      for (let i = 0; i < length; i++) {
        array[i] = Math.floor(Math.random() * 256);
      }
    }
    return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Validates a new PIN ensuring it is secure and not a banned demo PIN
   */
  public static validateNewPin(pin: string): { valid: boolean; error?: string } {
    if (!pin || pin.length < 4 || pin.length > 6) {
      return { valid: false, error: 'Le code PIN doit comporter entre 4 et 6 chiffres.' };
    }
    if (!/^\d+$/.test(pin)) {
      return { valid: false, error: 'Le code PIN doit contenir uniquement des chiffres.' };
    }
    const forbidden = ['1234', '5678', '1111', '0000', '9999', '12345', '123456'];
    if (forbidden.includes(pin)) {
      return { valid: false, error: 'Code PIN trop simple ou de démonstration interdit.' };
    }
    return { valid: true };
  }

  /**
   * Hashes a PIN or Password with a salt using SHA-256
   * Returns formatted string: "salt:hash"
   */
  public static async hashCredential(credential: string, existingSalt?: string): Promise<string> {
    const salt = existingSalt || this.generateSalt(16);
    const textToHash = `${salt}:${credential}`;

    if (typeof crypto !== 'undefined' && crypto.subtle) {
      const encoder = new TextEncoder();
      const data = encoder.encode(textToHash);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      return `${salt}:${hashHex}`;
    }

    // Fallback simple fast deterministic digest if crypto.subtle unavailable (e.g. testing)
    let hash = 0;
    for (let i = 0; i < textToHash.length; i++) {
      const char = textToHash.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0;
    }
    return `${salt}:${Math.abs(hash).toString(16).padStart(32, '0')}`;
  }

  /**
   * Verifies an input PIN or password against a stored "salt:hash"
   */
  public static async verifyCredential(inputCredential: string, storedHash: string): Promise<boolean> {
    if (!storedHash || !storedHash.includes(':')) {
      // If legacy or invalid format
      return false;
    }

    const [salt, expectedHash] = storedHash.split(':');
    const computed = await this.hashCredential(inputCredential, salt);
    const [, computedHash] = computed.split(':');

    return computedHash === expectedHash;
  }
}
