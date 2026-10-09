// Aquadro POS Algérie V2 — Module Arithmétique & Devises Dinar Algérien (DZD)
// RÈGLE CRITIQUE : Calculs stricts en centimes entiers pour éliminer tout risque de dérive à virgule flottante.

export interface TvaCalculationResult {
  htAmount: number;     // Montant Hors Taxe en DZD
  tvaAmount: number;    // Montant de la taxe en DZD
  ttcAmount: number;    // Montant Toutes Taxes Comprises en DZD
  rateApplied: number;  // Taux appliqué (0.19, 0.09, 0.00)
}

export class CurrencyUtil {
  // Conversion montant décimal en centimes entiers (1500.50 -> 150050)
  public static toCentimes(amount: number): number {
    return Math.round(amount * 100);
  }

  // Conversion centimes entiers en montant décimal (150050 -> 1500.50)
  public static fromCentimes(centimes: number): number {
    return centimes / 100;
  }

  // Addition exacte de deux montants
  public static add(a: number, b: number): number {
    return this.fromCentimes(this.toCentimes(a) + this.toCentimes(b));
  }

  // Soustraction exacte de deux montants
  public static subtract(a: number, b: number): number {
    return this.fromCentimes(this.toCentimes(a) - this.toCentimes(b));
  }

  // Multiplication exacte (ex: quantité * prix unitaire) avec arrondi commercial
  public static multiply(amount: number, factor: number): number {
    const amountInCentimes = this.toCentimes(amount);
    return this.fromCentimes(Math.round(amountInCentimes * factor));
  }

  // Calcul fiscal conforme DGI Algérie
  // Si le magasin est au régime Réel avec prix de vente public TTC :
  // Base HT = TTC / (1 + Taux TVA)
  // Montant TVA = TTC - Base HT
  public static calculateTVAFromTTC(ttcAmount: number, tvaRate: number = 0.19): TvaCalculationResult {
    if (tvaRate <= 0) {
      return {
        htAmount: ttcAmount,
        tvaAmount: 0,
        ttcAmount: ttcAmount,
        rateApplied: 0
      };
    }

    const ttcCentimes = this.toCentimes(ttcAmount);
    // Base HT = TTC / (1 + rate)
    const htCentimes = Math.round(ttcCentimes / (1 + tvaRate));
    const tvaCentimes = ttcCentimes - htCentimes;

    return {
      htAmount: this.fromCentimes(htCentimes),
      tvaAmount: this.fromCentimes(tvaCentimes),
      ttcAmount: ttcAmount,
      rateApplied: tvaRate
    };
  }

  // Calcul fiscal classique : HT -> TVA -> TTC
  public static calculateTVAFromHT(htAmount: number, tvaRate: number = 0.19): TvaCalculationResult {
    if (tvaRate <= 0) {
      return {
        htAmount: htAmount,
        tvaAmount: 0,
        ttcAmount: htAmount,
        rateApplied: 0
      };
    }

    const htCentimes = this.toCentimes(htAmount);
    const tvaCentimes = Math.round(htCentimes * tvaRate);
    const ttcCentimes = htCentimes + tvaCentimes;

    return {
      htAmount: htAmount,
      tvaAmount: this.fromCentimes(tvaCentimes),
      ttcAmount: this.fromCentimes(ttcCentimes),
      rateApplied: tvaRate
    };
  }

  // Formatage standard commercial algérien (Français) : ex: "1 500 DA" ou "1 500,00 DA"
  public static formatDZD(amount: number, includeDecimals: boolean = false): string {
    const isNegative = amount < 0;
    const absAmount = Math.abs(amount);

    const fixed = absAmount.toFixed(includeDecimals ? 2 : 0);
    const parts = fixed.split('.');
    
    // Séparateur de milliers par espace insécable
    const integerWithSpaces = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    const formatted = includeDecimals && parts[1] && parts[1] !== '00'
      ? `${integerWithSpaces},${parts[1]}`
      : integerWithSpaces;

    return `${isNegative ? '-' : ''}${formatted} DA`;
  }

  // Formatage standard commercial algérien (Arabe) : ex: "1 500 دج"
  public static formatDZDAr(amount: number, includeDecimals: boolean = false): string {
    const isNegative = amount < 0;
    const absAmount = Math.abs(amount);

    const fixed = absAmount.toFixed(includeDecimals ? 2 : 0);
    const parts = fixed.split('.');
    
    const integerWithSpaces = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    const formatted = includeDecimals && parts[1] && parts[1] !== '00'
      ? `${integerWithSpaces},${parts[1]}`
      : integerWithSpaces;

    return `${isNegative ? '-' : ''}${formatted} دج`;
  }
}
