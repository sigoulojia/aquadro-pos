import { describe, it, expect } from 'vitest';
import { CartService } from '../src/services/cart.service';
import { Product } from '../src/types/database';

const mockProductA: Product = {
  id: 'prod-whey-test',
  store_id: 'store-01',
  category_id: 'cat-protein',
  brand_id: 'brand-on',
  name: 'Gold Standard 100% Whey 2.27kg',
  sku: 'ON-WHEY-2KG',
  barcode: '748927028669',
  purchase_price: 13500.00,
  selling_price: 16800.00,
  current_stock: 20,
  min_stock_threshold: 5,
  is_active: 1,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
};

const mockProductB: Product = {
  id: 'prod-creatine-test',
  store_id: 'store-01',
  category_id: 'cat-creatine',
  brand_id: 'brand-on',
  name: 'Creatine Monohydrate 300g',
  sku: 'ON-CREATINE-300G',
  barcode: '748927023848',
  purchase_price: 3200.00,
  selling_price: 4500.00,
  discount_price: 4200.00, // On promotion for 4 200 DA
  current_stock: 15,
  min_stock_threshold: 5,
  is_active: 1,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
};

describe('CartService Business Logic & Calculations (Algerian Market)', () => {
  it('creates an empty cart with IFU default (0% TVA - direct TTC)', () => {
    const cart = CartService.createEmptyCart(0.0);
    expect(cart.items).toHaveLength(0);
    expect(cart.customer).toBeNull();
    expect(cart.taxRate).toBe(0.0);

    const totals = CartService.calculateTotals(cart);
    expect(totals.total).toBe(0);
    expect(totals.itemCount).toBe(0);
  });

  it('adds products to cart and respects promotional discount_price in DZD', () => {
    let cart = CartService.createEmptyCart(0.0); // IFU regime: 0% TVA
    cart = CartService.addItem(cart, mockProductA, 2); // 2 * 16 800 = 33 600 DA
    cart = CartService.addItem(cart, mockProductB, 1); // 1 * 4 200 (promo) = 4 200 DA

    expect(cart.items).toHaveLength(2);
    expect(cart.items[0].quantity).toBe(2);
    expect(cart.items[0].unitPrice).toBe(16800.00);
    expect(cart.items[1].quantity).toBe(1);
    expect(cart.items[1].unitPrice).toBe(4200.00);

    const totals = CartService.calculateTotals(cart);
    expect(totals.subtotal).toBe(37800.00);
    expect(totals.itemCount).toBe(3);
    expect(totals.taxAmount).toBe(0.00); // 0 TVA under IFU
    expect(totals.total).toBe(37800.00);
  });

  it('calculates Algerian Régime Réel TVA (19% normal rate) accurately', () => {
    let cart = CartService.createEmptyCart(0.19); // 19% TVA
    cart = CartService.addItem(cart, mockProductA, 1); // 16 800 DA

    const totals = CartService.calculateTotals(cart);
    expect(totals.subtotal).toBe(16800.00);
    // TVA = 16 800 * 0.19 = 3 192.00 DA
    expect(totals.taxAmount).toBe(3192.00);
    // Total TTC = 16 800 + 3 192 = 19 992.00 DA
    expect(totals.total).toBe(19992.00);
  });

  it('increments quantity when existing item is added again', () => {
    let cart = CartService.createEmptyCart(0.0);
    cart = CartService.addItem(cart, mockProductA, 1);
    cart = CartService.addItem(cart, mockProductA, 3);

    expect(cart.items).toHaveLength(1);
    expect(cart.items[0].quantity).toBe(4);
    expect(cart.items[0].totalPrice).toBe(67200.00);
  });

  it('removes item when quantity is updated to 0 or less', () => {
    let cart = CartService.createEmptyCart(0.0);
    cart = CartService.addItem(cart, mockProductA, 2);
    const itemId = cart.items[0].id;

    cart = CartService.updateQuantity(cart, itemId, 0);
    expect(cart.items).toHaveLength(0);
  });

  it('correctly applies line item percentage discount', () => {
    let cart = CartService.createEmptyCart(0.0);
    cart = CartService.addItem(cart, mockProductA, 1); // 16 800 DA
    const itemId = cart.items[0].id;

    // Apply 10% discount on the line item
    cart = CartService.applyLineDiscount(cart, itemId, 10);

    expect(cart.items[0].discountPercent).toBe(10);
    expect(cart.items[0].discountAmount).toBe(1680.00);
    expect(cart.items[0].totalPrice).toBe(15120.00);

    const totals = CartService.calculateTotals(cart);
    expect(totals.totalDiscount).toBe(1680.00);
    expect(totals.total).toBe(15120.00);
  });

  it('applies order-level fixed discount in DZD', () => {
    let cart = CartService.createEmptyCart(0.0);
    cart = CartService.addItem(cart, mockProductA, 2); // 33 600 DA

    // Apply 2 000 DA fixed order discount
    cart = CartService.applyOrderDiscount(cart, {
      type: 'FIXED_AMOUNT',
      value: 2000.00,
      reason: 'Remise Fidélité Client'
    });

    const totals = CartService.calculateTotals(cart);
    expect(totals.subtotal).toBe(33600.00);
    expect(totals.orderDiscountAmount).toBe(2000.00);
    expect(totals.total).toBe(31600.00);
  });
});
