import { describe, it, expect, beforeEach } from 'vitest';
import { checkoutService } from '../src/services/checkout.service';
import { CartService } from '../src/services/cart.service';
import { productService } from '../src/services/product.service';
import { db } from '../src/db/sqlite';
import { SEED_STORE } from '../src/db/seed';
import { SaleItem } from '../src/types/database';

describe('Historical Purchase Cost Snapshot Invariance & Financial Integrity', () => {
  beforeEach(async () => {
    await db.initialize();
  });

  it('preserves immutable historical purchase cost snapshot when product purchase cost increases later', async () => {
    // 1. Create a product with purchase cost 8 000 DA and selling price 11 000 DA
    const now = new Date().toISOString();
    const testProdId = 'prod-cost-test-' + Math.random().toString(36).substring(2, 7);

    await db.execute(
      `INSERT INTO products (id, store_id, category_id, brand_id, name, sku, barcode, purchase_price, selling_price, current_stock, min_stock_threshold, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [testProdId, 'store-01', 'cat-01', 'brand-01', 'Whey Isolate DZ', 'ISO-DZ-01', '6131234567890', 8000.00, 11000.00, 50, 5, 1, now, now]
    );

    const product = await productService.getProductById(testProdId);
    expect(product).not.toBeNull();
    expect(product?.purchase_price).toBe(8000.00);

    // 2. Perform checkout of 2 units
    let cart = CartService.createEmptyCart(0.0);
    cart = CartService.addItem(cart, product!, 2);

    const result = await checkoutService.completeSale(
      cart,
      [{ method: 'CASH', amount: 22000.00, tenderedAmount: 22000.00, changeGiven: 0 }],
      'user-002',
      'Yacine Amrani',
      SEED_STORE
    );

    // Check recorded sale items in database
    const saleItems = await db.select<SaleItem>('SELECT * FROM sale_items WHERE sale_id = ?', [result.sale.id]);
    expect(saleItems).toHaveLength(1);
    expect(saleItems[0].unit_purchase_price).toBe(8000.00);
    expect(saleItems[0].unit_price).toBe(11000.00);
    expect(saleItems[0].quantity).toBe(2);

    // Initial Gross Profit = 2 * (11 000 - 8 000) = 6 000 DA
    const initialProfit = (saleItems[0].unit_price - saleItems[0].unit_purchase_price) * saleItems[0].quantity;
    expect(initialProfit).toBe(6000.00);

    // 3. Supplier price hike: Current product purchase cost changes from 8 000 DA to 9 500 DA
    await productService.updateProduct(testProdId, {
      purchase_price: 9500.00
    });

    const updatedProd = await productService.getProductById(testProdId);
    expect(updatedProd?.purchase_price).toBe(9500.00);

    // 4. CRITICAL AUDIT: Historical sale record in database MUST STILL be 8 000 DA
    const auditedSaleItems = await db.select<SaleItem>('SELECT * FROM sale_items WHERE sale_id = ?', [result.sale.id]);
    expect(auditedSaleItems[0].unit_purchase_price).toBe(8000.00);

    // Past recorded profit remains exactly 6 000 DA, NOT eroded to 3 000 DA by subsequent supplier inflation
    const auditedProfit = (auditedSaleItems[0].unit_price - auditedSaleItems[0].unit_purchase_price) * auditedSaleItems[0].quantity;
    expect(auditedProfit).toBe(6000.00);
  });
});
