import { describe, it, expect, beforeEach } from 'vitest';
import { checkoutService } from '../src/services/checkout.service';
import { salesService } from '../src/services/sales.service';
import { productService } from '../src/services/product.service';
import { CartService } from '../src/services/cart.service';
import { db } from '../src/db/sqlite';
import { SEED_STORE } from '../src/db/seed';

describe('Sales & Refund Management', () => {
  beforeEach(async () => {
    await db.initialize();
  });

  it('processes item return, calculates refund, restocks shelf, and records audit trail', async () => {
    const products = await productService.getProducts();
    const product = products[0];

    // 1. Create a sale with 2 items
    let cart = CartService.createEmptyCart(SEED_STORE.tax_rate);
    cart = CartService.addItem(cart, product, 2);
    const totals = CartService.calculateTotals(cart);

    const { sale } = await checkoutService.completeSale(
      cart,
      [{ method: 'CASH', amount: totals.total, tenderedAmount: totals.total, changeGiven: 0 }],
      'user-003',
      'Sarah Connor',
      SEED_STORE
    );

    const initialStockBeforeRefund = (await productService.getProductById(product.id))?.current_stock || 0;

    // 2. Fetch full sale with items
    const fullSale = await salesService.getSaleById(sale.id);
    expect(fullSale?.items).toHaveLength(1);
    const saleItem = fullSale!.items![0];

    // 3. Process partial refund of 1 item with restock: true
    const refund = await salesService.processRefund({
      saleId: sale.id,
      items: [
        {
          saleItemId: saleItem.id,
          productId: saleItem.product_id,
          quantity: 1,
          refundPrice: saleItem.unit_price,
          restock: true
        }
      ],
      reason: 'Customer flavor exchange',
      cashierId: 'user-002' // Marcus Manager
    });

    // 4. Verify refund record
    expect(refund.receipt_number).toContain('REF-');
    expect(refund.refund_amount).toBe(saleItem.unit_price);

    // 5. Verify inventory restocked by 1
    const refreshedProd = await productService.getProductById(product.id);
    expect(refreshedProd?.current_stock).toBe(initialStockBeforeRefund + 1);

    // 6. Verify original sale status changed to PARTIALLY_REFUNDED
    const updatedSale = await salesService.getSaleById(sale.id);
    expect(updatedSale?.status).toBe('PARTIALLY_REFUNDED');

    // 7. Verify audit log entry
    const auditLogs = await db.select('SELECT * FROM audit_logs WHERE entity_id = ?', [sale.id]);
    expect(auditLogs.length).toBeGreaterThan(0);
    expect(auditLogs[0].action).toBe('PROCESS_REFUND');
  });
});
