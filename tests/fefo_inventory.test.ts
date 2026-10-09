import { describe, it, expect, beforeEach } from 'vitest';
import { inventoryService } from '../src/services/inventory.service';
import { productService } from '../src/services/product.service';
import { db } from '../src/db/sqlite';

describe('FEFO (First Expired, First Out) Inventory & Batch Management', () => {
  beforeEach(async () => {
    await db.initialize();
  });

  it('allocates stock prioritizing the earliest expiring batch (FEFO)', async () => {
    const products = await productService.getProducts();
    const product = products[0]; // prod-001 has two batches in seed:
    // Batch 1 (LOT-2026-EARLY): expires 2027-01-15, qty 10, cost 13000
    // Batch 2 (LOT-2026-LATE): expires 2027-08-30, qty 25, cost 13500

    const batches = await inventoryService.getProductBatches(product.id);
    expect(batches.length).toBeGreaterThanOrEqual(2);
    expect(new Date(batches[0].expiration_date).getTime()).toBeLessThan(new Date(batches[1].expiration_date).getTime());

    // Request 5 units (less than earliest batch stock of 10)
    const allocations = await inventoryService.allocateFefoBatches(product.id, 5);
    expect(allocations).toHaveLength(1);
    expect(allocations[0].batchNumber).toBe('LOT-2026-EARLY');
    expect(allocations[0].quantity).toBe(5);
    expect(allocations[0].purchasePrice).toBe(13000);
  });

  it('splits allocation across multiple batches when quantity exceeds earliest batch', async () => {
    const products = await productService.getProducts();
    const product = products[0];

    // Request 15 units (earliest batch has 10, next batch has 25)
    const allocations = await inventoryService.allocateFefoBatches(product.id, 15);
    expect(allocations).toHaveLength(2);

    // Slice 1: 10 units from earliest batch @ 13 000 DA
    expect(allocations[0].batchNumber).toBe('LOT-2026-EARLY');
    expect(allocations[0].quantity).toBe(10);
    expect(allocations[0].purchasePrice).toBe(13000);

    // Slice 2: 5 units from next batch @ 13 500 DA
    expect(allocations[1].batchNumber).toBe('LOT-2026-LATE');
    expect(allocations[1].quantity).toBe(5);
    expect(allocations[1].purchasePrice).toBe(13500);
  });

  it('blocks sales and throws an error when an attempt is made to sell expired stock', async () => {
    // Insert a product with an expired batch
    const now = new Date().toISOString();
    const expiredProdId = 'prod-expired-test';

    await db.execute(
      `INSERT INTO products (id, store_id, category_id, brand_id, name, sku, barcode, purchase_price, selling_price, current_stock, min_stock_threshold, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [expiredProdId, 'store-01', 'cat-01', 'brand-01', 'Expired Mass Gainer', 'EXP-MASS-01', '999888777111', 8000, 12000, 5, 2, 1, now, now]
    );

    await db.execute(
      `INSERT INTO product_batches (id, product_id, batch_number, expiration_date, current_stock, purchase_price, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ['batch-exp-01', expiredProdId, 'LOT-PAST-EXP', '2025-01-01', 5, 8000, now]
    );

    // Attempting to allocate stock should be blocked by FEFO safety guard
    await expect(
      inventoryService.allocateFefoBatches(expiredProdId, 2)
    ).rejects.toThrow(/périmé/);
  });

  it('decrements batch stock atomically upon checkout', async () => {
    const products = await productService.getProducts();
    const product = products[0];
    const initialBatches = await inventoryService.getProductBatches(product.id);
    const firstBatch = initialBatches[0];
    const initialBatchStock = firstBatch.current_stock;

    await inventoryService.decrementBatchStock(firstBatch.id, 3);

    const updatedBatches = await inventoryService.getProductBatches(product.id);
    const updatedFirst = updatedBatches.find(b => b.id === firstBatch.id);
    expect(updatedFirst?.current_stock).toBe(initialBatchStock - 3);
  });
});
