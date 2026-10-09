import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ScannerInputManager } from '../src/core/keyboard/ScannerInputManager';
import { CartService } from '../src/services/cart.service';
import { Product } from '../src/types/database';

const mockProductA: Product = {
  id: 'prod-barcode-a',
  store_id: 'store-01',
  category_id: 'cat-01',
  brand_id: 'brand-01',
  name_fr: 'Whey Protein Isolate 1kg',
  name_ar: 'واي بروتين معزول 1كغ',
  sku: 'WHEY-ISO-1KG',
  barcode: '6131234567890',
  purchase_cost: 8000,
  selling_price_ttc: 12000,
  current_stock: 10,
  min_stock_alert: 2,
  unit_of_measure: 'UNIT',
  box_conversion_ratio: 1.0,
  tva_rate: 0.0,
  is_active: 1,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
};

const mockProductB: Product = {
  id: 'prod-barcode-b',
  store_id: 'store-01',
  category_id: 'cat-01',
  brand_id: 'brand-01',
  name_fr: 'Creatine Monohydrate 300g',
  name_ar: 'كرياتين مونوهيدرات 300غ',
  sku: 'CREA-MONO-300G',
  barcode: '6139876543210',
  purchase_cost: 3000,
  selling_price_ttc: 4500,
  current_stock: 5,
  min_stock_alert: 1,
  unit_of_measure: 'UNIT',
  box_conversion_ratio: 1.0,
  tva_rate: 0.0,
  is_active: 1,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
};

describe('Permanent Barcode Scanner Workflow & Concurrency Tests', () => {
  let manager: ScannerInputManager;

  beforeEach(() => {
    manager = ScannerInputManager.getInstance();
  });

  afterEach(() => {
    manager.destroy();
  });

  it('receives barcode scans via simulated rapid input and triggers registered callbacks', () => {
    const receivedBarcodes: string[] = [];
    const unsubscribe = manager.subscribe((code) => {
      receivedBarcodes.push(code);
    });

    manager.simulateScan('6131234567890');
    expect(receivedBarcodes).toEqual(['6131234567890']);

    unsubscribe();
    manager.simulateScan('6139876543210');
    // Callback should not be called after unsubscribing
    expect(receivedBarcodes).toEqual(['6131234567890']);
  });

  it('handles consecutive rapid barcode scans of the same product by incrementing quantity', () => {
    let cart = CartService.createEmptyCart(0.0);

    // Simulate Scan 1: Product A
    cart = CartService.addItem(cart, mockProductA, 1);
    expect(cart.items).toHaveLength(1);
    expect(cart.items[0].productId).toBe(mockProductA.id);
    expect(cart.items[0].quantity).toBe(1);
    expect(cart.items[0].totalPrice).toBe(12000);

    // Simulate Consecutive Scan 2: Product A scanned again
    cart = CartService.addItem(cart, mockProductA, 1);
    expect(cart.items).toHaveLength(1); // Still 1 line item!
    expect(cart.items[0].quantity).toBe(2);
    expect(cart.items[0].totalPrice).toBe(24000);

    // Simulate Consecutive Scan 3: Product A scanned again
    cart = CartService.addItem(cart, mockProductA, 1);
    expect(cart.items).toHaveLength(1);
    expect(cart.items[0].quantity).toBe(3);
    expect(cart.items[0].totalPrice).toBe(36000);

    const totals = CartService.calculateTotals(cart);
    expect(totals.total).toBe(36000);
    expect(totals.itemCount).toBe(3);
  });

  it('handles alternating consecutive scans of multiple distinct products without collision', () => {
    let cart = CartService.createEmptyCart(0.0);

    // Scan A -> Scan B -> Scan A
    cart = CartService.addItem(cart, mockProductA, 1);
    cart = CartService.addItem(cart, mockProductB, 1);
    cart = CartService.addItem(cart, mockProductA, 1);

    expect(cart.items).toHaveLength(2);
    const itemA = cart.items.find(i => i.productId === mockProductA.id);
    const itemB = cart.items.find(i => i.productId === mockProductB.id);

    expect(itemA?.quantity).toBe(2);
    expect(itemB?.quantity).toBe(1);

    const totals = CartService.calculateTotals(cart);
    // (2 * 12000) + (1 * 4500) = 24000 + 4500 = 28500
    expect(totals.total).toBe(28500);
    expect(totals.itemCount).toBe(3);
  });

  it('distinguishes rapid hardware scanner keystrokes from slow human typing via keydown events', () => {
    const receivedBarcodes: string[] = [];
    const unsubscribe = manager.subscribe((code) => {
      receivedBarcodes.push(code);
    });

    const now = Date.now();
    vi.useFakeTimers();
    vi.setSystemTime(now);

    // 1. Simulate fast scanner burst: "61312345" at 15ms intervals
    const barcodeChars = '61312345';
    for (const char of barcodeChars) {
      manager.handleTestKey(char);
      vi.advanceTimersByTime(15);
    }
    // Scanner sends Enter
    manager.handleTestKey('Enter');
    expect(receivedBarcodes).toEqual(['61312345']);

    // 2. Simulate slow human typing: "ABC" at 150ms intervals
    vi.advanceTimersByTime(500);
    for (const char of 'ABC') {
      manager.handleTestKey(char);
      vi.advanceTimersByTime(150); // Human speed (> 65ms)
    }
    manager.handleTestKey('Enter');

    // Slow typing should NOT have triggered a barcode scan
    expect(receivedBarcodes).toEqual(['61312345']);

    vi.useRealTimers();
    unsubscribe();
  });

  it('ignores keyboard repeat events to avoid false scans from held keys', () => {
    const receivedBarcodes: string[] = [];
    const unsubscribe = manager.subscribe((code) => {
      receivedBarcodes.push(code);
    });

    // Simulate key repeat: user holds down '0'
    for (let i = 0; i < 10; i++) {
      manager.handleTestKey('0', true);
    }
    manager.handleTestKey('Enter');

    expect(receivedBarcodes).toHaveLength(0);
    unsubscribe();
  });

  it('does not intercept typing or Enter when target is a standard user input field', () => {
    const receivedBarcodes: string[] = [];
    const unsubscribe = manager.subscribe((code) => {
      receivedBarcodes.push(code);
    });

    const mockStandardInput = {
      tagName: 'INPUT',
      isContentEditable: false,
      getAttribute: (attr: string) => (attr === 'data-barcode-scanner' ? null : null)
    };

    // User rapidly types "CASH" in customer/search input
    for (const char of 'CASH') {
      manager.handleTestKey(char, false, mockStandardInput);
    }
    manager.handleTestKey('Enter', false, mockStandardInput);

    // Must NOT have intercepted standard input typing
    expect(receivedBarcodes).toHaveLength(0);
    unsubscribe();
  });

  it('correctly intercepts scans directed at the dedicated barcode scanner input', () => {
    const receivedBarcodes: string[] = [];
    const unsubscribe = manager.subscribe((code) => {
      receivedBarcodes.push(code);
    });

    const mockDedicatedScanner = {
      tagName: 'INPUT',
      isContentEditable: false,
      getAttribute: (attr: string) => (attr === 'data-barcode-scanner' ? 'true' : null)
    };

    // Scanner transmits "6131234567890" into dedicated scanner element
    for (const char of '6131234567890') {
      manager.handleTestKey(char, false, mockDedicatedScanner);
    }
    manager.handleTestKey('Enter', false, mockDedicatedScanner);

    expect(receivedBarcodes).toEqual(['6131234567890']);
    unsubscribe();
  });

  it('simulates rapid consecutive scans of the same product without dropping scans', () => {
    let cart = CartService.createEmptyCart(0.0);

    // Rapid Scan 1
    cart = CartService.addItem(cart, mockProductA, 1);
    // Rapid Scan 2
    cart = CartService.addItem(cart, mockProductA, 1);
    // Rapid Scan 3
    cart = CartService.addItem(cart, mockProductA, 1);

    expect(cart.items).toHaveLength(1);
    expect(cart.items[0].quantity).toBe(3);
    expect(cart.items[0].productId).toBe(mockProductA.id);
    expect(cart.items[0].totalPrice).toBe(36000);
  });
});
