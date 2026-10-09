import { describe, it, expect, beforeEach } from 'vitest';
import { checkoutService } from '../src/services/checkout.service';
import { CartService } from '../src/services/cart.service';
import { productService } from '../src/services/product.service';
import { customerService } from '../src/services/customer.service';
import { db } from '../src/db/sqlite';
import { SEED_STORE } from '../src/db/seed';

describe('CheckoutService & Financial Integrity', () => {
  beforeEach(async () => {
    await db.initialize();
  });

  it('completes atomic checkout, calculates totals, decrements stock, and generates idempotency key', async () => {
    const products = await productService.getProducts();
    const product = products[0];
    const initialStock = product.current_stock;

    let cart = CartService.createEmptyCart(SEED_STORE.tax_rate);
    cart = CartService.addItem(cart, product, 2);

    const totals = CartService.calculateTotals(cart);
    const tendered = Math.ceil(totals.total / 1000) * 1000; // Round up to nearest 1000 DA bill

    const result = await checkoutService.completeSale(
      cart,
      [
        {
          method: 'CASH',
          amount: totals.total,
          tenderedAmount: tendered,
          changeGiven: tendered - totals.total
        }
      ],
      'user-002',
      'Yacine Amrani',
      SEED_STORE
    );

    // 1. Verify sale attributes
    expect(result.sale.id).toBeDefined();
    expect(result.sale.idempotency_key).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    expect(result.sale.receipt_number).toMatch(/^REC-\d{8}-\d{4}$/);
    expect(result.sale.status).toBe('COMPLETED');
    expect(result.sale.total_amount).toBe(totals.total);
    expect(result.changeGiven).toBe(CartService.calculateChange(totals.total, tendered));

    // 2. Verify stock decremented by 2
    const updatedProd = await productService.getProductById(product.id);
    expect(updatedProd?.current_stock).toBe(initialStock - 2);

    // 3. Verify sync operation enqueued
    const syncOps = await db.select('SELECT * FROM sync_operations WHERE record_id = ?', [result.sale.id]);
    expect(syncOps).toHaveLength(1);
    expect(syncOps[0].action).toBe('INSERT');
    expect(syncOps[0].table_name).toBe('sales');
  });

  it('accrues loyalty points when customer is attached to cart', async () => {
    const customers = await customerService.getCustomers();
    const customer = customers[0];
    const initialPoints = customer.loyalty_points;
    const initialSpend = customer.total_spent;

    const products = await productService.getProducts();
    let cart = CartService.createEmptyCart(SEED_STORE.tax_rate);
    cart = CartService.addItem(cart, products[0], 1);
    cart = CartService.setCustomer(cart, customer);

    const totals = CartService.calculateTotals(cart);
    const expectedPoints = Math.floor(totals.total / 100); // 1 point per 100 DA in Algerian loyalty

    await checkoutService.completeSale(
      cart,
      [
        {
          method: 'CARD',
          amount: totals.total,
          tenderedAmount: totals.total,
          changeGiven: 0,
          cardBrand: 'CIB',
          cardLastFour: 'TPE'
        }
      ],
      'user-002',
      'Yacine Amrani',
      SEED_STORE
    );

    const updatedCustomer = await customerService.getCustomerById(customer.id);
    expect(updatedCustomer?.loyalty_points).toBe(initialPoints + expectedPoints);
    expect(updatedCustomer?.total_spent).toBeCloseTo(initialSpend + totals.total, 2);
  });

  it('throws error when payment tendered is less than total', async () => {
    const products = await productService.getProducts();
    let cart = CartService.createEmptyCart(SEED_STORE.tax_rate);
    cart = CartService.addItem(cart, products[0], 1);

    await expect(
      checkoutService.completeSale(
        cart,
        [{ method: 'CASH', amount: 10, tenderedAmount: 10, changeGiven: 0 }],
        'user-002',
        'Yacine Amrani',
        SEED_STORE
      )
    ).rejects.toThrow(/Paiement insuffisant/);
  });
});
