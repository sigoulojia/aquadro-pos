/**
 * Aquadro POS - Safe Currency and Financial Arithmetic Engine
 * Specifically localized for Algeria (DZD / دج / DA) and physical retail stores.
 * Uses integer minor units (centimes: 1 DZD = 100 centimes) to eliminate floating point drift.
 */

export interface CurrencyConfig {
  code: string;       // e.g. 'DZD'
  symbol: string;     // e.g. 'DA' or 'دج'
  decimals: number;   // 2 decimals
  symbolPosition: 'before' | 'after';
  thousandsSeparator: string;
  decimalSeparator: string;
}

export const DZD_CONFIG: CurrencyConfig = {
  code: 'DZD',
  symbol: 'DA',
  decimals: 2,
  symbolPosition: 'after',
  thousandsSeparator: ' ',
  decimalSeparator: ','
};

export const DZD_ARABIC_CONFIG: CurrencyConfig = {
  code: 'DZD',
  symbol: 'دج',
  decimals: 2,
  symbolPosition: 'after',
  thousandsSeparator: ' ',
  decimalSeparator: ','
};

export interface TvaCalculationResult {
  tvaAmount: number;
  ttcAmount: number;
  htAmount: number;
  tvaRate: number;
}

export class CurrencyUtil {
  /**
   * Converts a decimal monetary amount to integer centimes (minor units)
   * e.g. 1500.50 DZD -> 150050 centimes
   */
  public static toCentimes(amount: number): number {
    return Math.round((amount + Number.EPSILON) * 100);
  }

  /**
   * Converts integer centimes back to decimal amount
   * e.g. 150050 centimes -> 1500.50 DZD
   */
  public static fromCentimes(centimes: number): number {
    return centimes / 100;
  }

  /**
   * Safe financial addition avoiding floating point drift
   */
  public static add(a: number, b: number): number {
    return this.fromCentimes(this.toCentimes(a) + this.toCentimes(b));
  }

  /**
   * Safe financial subtraction avoiding floating point drift
   */
  public static subtract(a: number, b: number): number {
    return this.fromCentimes(this.toCentimes(a) - this.toCentimes(b));
  }

  /**
   * Safe financial multiplication with rounding
   */
  public static multiply(amount: number, factor: number): number {
    return Math.round((this.toCentimes(amount) * factor) + Number.EPSILON) / 100;
  }

  /**
   * Formats a monetary amount into localized Algerian Dinar representation
   * Default: "1 500,00 DA"
   */
  public static formatDZD(amount: number, config: CurrencyConfig = DZD_CONFIG): string {
    const fixed = Math.abs(amount).toFixed(config.decimals);
    const parts = fixed.split('.');
    const integerPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, config.thousandsSeparator);
    const decimalPart = parts[1];

    const formattedNumber = `${integerPart}${config.decimalSeparator}${decimalPart}`;
    const sign = amount < 0 ? '-' : '';

    if (config.symbolPosition === 'after') {
      return `${sign}${formattedNumber} ${config.symbol}`;
    }
    return `${sign}${config.symbol} ${formattedNumber}`;
  }

  /**
   * Formats a monetary amount into Arabic Algerian Dinar representation
   * e.g. 1500.00 -> "1 500,00 دج"
   */
  public static formatDZDArabic(amount: number): string {
    return this.formatDZD(amount, DZD_ARABIC_CONFIG);
  }

  /**
   * Calculates Algerian VAT/TVA (0% IFU, 9% reduced, 19% standard) safely
   */
  public static calculateTVA(taxableAmount: number, tvaRate: number): TvaCalculationResult {
    if (tvaRate <= 0) {
      return {
        tvaAmount: 0,
        ttcAmount: taxableAmount,
        htAmount: taxableAmount,
        tvaRate: 0
      };
    }
    const centimesTaxable = this.toCentimes(taxableAmount);
    const centimesTVA = Math.round(centimesTaxable * tvaRate);
    const tvaAmount = this.fromCentimes(centimesTVA);
    const ttcAmount = this.add(taxableAmount, tvaAmount);

    return {
      tvaAmount,
      ttcAmount,
      htAmount: taxableAmount,
      tvaRate
    };
  }

  /**
   * Calculates line or order discount safely
   */
  public static calculateDiscount(grossAmount: number, percent: number, maxCap?: number): number {
    if (percent <= 0) return 0;
    const safePercent = Math.min(100, Math.max(0, percent));
    let discount = this.multiply(grossAmount, safePercent / 100);
    if (maxCap !== undefined && maxCap > 0) {
      discount = Math.min(discount, maxCap);
    }
    return discount;
  }
}
