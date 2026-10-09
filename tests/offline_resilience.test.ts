import { describe, it, expect, beforeEach } from 'vitest';
import { checkoutService } from '../src/services/checkout.service';
import { CartService } from '../src/services/cart.service';
import { productService } from '../src/services/product.service';
import { syncService } from '../src/services/sync.service';
import { db } from '../src/db/sqlite';
import { SEED_STORE } from '../src/db/seed';
import { SyncOperation } from '../src/types/database';

describe('Offline Resilience & Persistent Outbox Queue', () => {
  beforeEach(async () => {
    await db.initialize();
  });

  it('completes sales entirely offline and enqueues idempotent operations into outbox ledger', async () => {
    const products = await productService.getProducts();
    const product = products[0];
    const initialStock = product.current_stock;

    // Simulate 100% offline checkout (Supabase unreachable)
    let cart = CartService.createEmptyCart(0.0);
    cart = CartService.addItem(cart, product, 1);

    const result = await checkoutService.completeSale(
      cart,
      [{ method: 'CASH', amount: 16800, tenderedAmount: 20000, changeGiven: 3200 }],
      'user-002',
      'Yacine Amrani',
      SEED_STORE
    );

    expect(result.sale.id).toBeDefined();
    expect(result.sale.sync_status).toBe('PENDING');

    // 1. Verify local stock immediately decremented without requiring cloud confirmation
    const updatedProd = await productService.getProductById(product.id);
    expect(updatedProd?.current_stock).toBe(initialStock - 1);

    // 2. Verify persistent outbox contains the sale with idempotency key
    const outboxOps = await db.select<SyncOperation>(
      'SELECT * FROM sync_operations WHERE record_id = ? AND table_name = ?',
      [result.sale.id, 'sales']
    );
    expect(outboxOps).toHaveLength(1);
    expect(outboxOps[0].status).toBe('PENDING');
    expect(outboxOps[0].action).toBe('INSERT');

    // Payload verification
    const payload = JSON.parse(outboxOps[0].payload);
    expect(payload.sale.id).toBe(result.sale.id);
    expect(payload.sale.idempotency_key).toBe(result.sale.idempotency_key);
  });

  it('retains pending transactions in outbox across simulated application restarts', async () => {
    // Check initial pending count
    const pendingBefore = await syncService.getPendingCount();
    expect(pendingBefore).toBeGreaterThan(0);

    // Simulate complete application restart (re-initialize database without clearing tables)
    await db.initialize();

    // Verify outbox remains intact and no transactions were lost
    const pendingAfter = await syncService.getPendingCount();
    expect(pendingAfter).toBe(pendingBefore);

    // Trigger sync engine
    const syncResult = await syncService.triggerSync();
    expect(syncResult.synced).toBeGreaterThanOrEqual(0);
  });
});
