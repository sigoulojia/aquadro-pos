// Aquadro POS Algérie V2 — Module de Sécurité & Hachage Cryptographique
// Le hachage est désormais délégué au Backend Rust (Argon2).
// Ce fichier ne conserve que la validation UI (longueur, caractères, complexité).

export class SecurityUtil {
  private static readonly BLOCKED_PINS = new Set([
    '0000', '1111', '2222', '3333', '4444',
    '5555', '6666', '7777', '8888', '9999',
    '1234', '4321', '2345', '5432', '3456',
    '6543', '4567', '7654', '5678', '8765',
    '6789', '9876', '0123', '3210'
  ]);

  // Validation stricte d'un nouveau code PIN (4 à 8 chiffres)
  public static validateNewPin(pin: string): { valid: boolean; error?: string } {
    if (!pin || typeof pin !== 'string') {
      return { valid: false, error: 'Le code PIN est obligatoire.' };
    }

    const trimmed = pin.trim();
    if (trimmed.length < 4 || trimmed.length > 8) {
      return { valid: false, error: 'Le code PIN doit comporter entre 4 et 8 chiffres.' };
    }

    if (!/^\d+$/.test(trimmed)) {
      return { valid: false, error: 'Le code PIN ne doit contenir que des chiffres.' };
    }

    if (this.BLOCKED_PINS.has(trimmed)) {
      return {
        valid: false,
        error: 'Ce code PIN est trop simple ou par défaut. Veuillez choisir une combinaison sécurisée.'
      };
    }

    return { valid: true };
  }
}
