import { describe, it, expect } from 'vitest';
import { CurrencyUtil } from '../src/utils/currency';

describe('Algerian Dinar Currency & Fixed-Precision Arithmetic Engine', () => {
  it('converts between Dinars and Centimes without precision loss', () => {
    expect(CurrencyUtil.toCentimes(100)).toBe(10000);
    expect(CurrencyUtil.toCentimes(1500.50)).toBe(150050);
    expect(CurrencyUtil.toCentimes(0.05)).toBe(5);

    expect(CurrencyUtil.fromCentimes(10000)).toBe(100);
    expect(CurrencyUtil.fromCentimes(150050)).toBe(1500.50);
    expect(CurrencyUtil.fromCentimes(5)).toBe(0.05);
  });

  it('eliminates IEEE-754 floating-point drift in financial addition and subtraction', () => {
    // Standard JS float addition produces 0.30000000000000004
    const floatSum = 0.1 + 0.2;
    expect(floatSum).not.toBe(0.3);

    // CurrencyUtil produces exact 0.30
    const safeSum = CurrencyUtil.add(0.1, 0.2);
    expect(safeSum).toBe(0.3);

    // Subtraction precision
    const safeDiff = CurrencyUtil.subtract(100.00, 33.33);
    expect(safeDiff).toBe(66.67);
  });

  it('calculates Algerian TVA rates accurately (0% IFU, 9% reduced, 19% standard)', () => {
    const baseHT = 10000; // 10 000 DA

    // IFU Exempt / Direct TTC
    const ifuTva = CurrencyUtil.calculateTVA(baseHT, 0.0);
    expect(ifuTva.tvaAmount).toBe(0);
    expect(ifuTva.ttcAmount).toBe(10000);

    // 9% Reduced TVA
    const reducedTva = CurrencyUtil.calculateTVA(baseHT, 0.09);
    expect(reducedTva.tvaAmount).toBe(900);
    expect(reducedTva.ttcAmount).toBe(10900);

    // 19% Standard TVA
    const standardTva = CurrencyUtil.calculateTVA(baseHT, 0.19);
    expect(standardTva.tvaAmount).toBe(1900);
    expect(standardTva.ttcAmount).toBe(11900);
  });

  it('formats amounts according to Algerian standards (DZD / DA / دج)', () => {
    const formatted = CurrencyUtil.formatDZD(1500);
    expect(formatted).toContain('1');
    expect(formatted).toContain('500');
    expect(formatted).toContain('DA');

    const formattedArabic = CurrencyUtil.formatDZDArabic(25000);
    expect(formattedArabic).toContain('دج');
  });

  it('safely handles multiplication of unit prices and quantities', () => {
    const unitPrice = 16800.50; // 16 800.50 DA
    const quantity = 3;

    const total = CurrencyUtil.multiply(unitPrice, quantity);
    expect(total).toBe(50401.50);
  });
});
