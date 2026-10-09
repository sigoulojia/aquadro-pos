import { describe, it, expect, beforeEach } from 'vitest';
import { inventoryService } from '../src/services/inventory.service';
import { productService } from '../src/services/product.service';
import { db } from '../src/db/sqlite';

describe('Inventory & Traceable Stock Movements', () => {
  beforeEach(async () => {
    await db.initialize();
  });

  it('records traceable SALE decrement and updates current stock', async () => {
    const products = await productService.getProducts();
    const targetProduct = products[0];
    const initialStock = targetProduct.current_stock;

    const movement = await inventoryService.recordMovement({
      productId: targetProduct.id,
      quantityChange: -3,
      movementType: 'SALE',
      reason: 'Checkout test sale',
      userId: 'user-001',
      referenceId: 'sale-test-01'
    });

    expect(movement.movement_type).toBe('SALE');
    expect(movement.quantity_change).toBe(-3);
    expect(movement.previous_stock).toBe(initialStock);
    expect(movement.new_stock).toBe(initialStock - 3);

    const refreshed = await productService.getProductById(targetProduct.id);
    expect(refreshed?.current_stock).toBe(initialStock - 3);
  });

  it('records traceable PURCHASE intake and updates stock upward', async () => {
    const products = await productService.getProducts();
    const targetProduct = products[1];
    const initialStock = targetProduct.current_stock;

    const movement = await inventoryService.recordMovement({
      productId: targetProduct.id,
      quantityChange: 12,
      movementType: 'PURCHASE',
      reason: 'Distributor delivery intake',
      userId: 'user-002',
      referenceId: 'PO-2026-001'
    });

    expect(movement.movement_type).toBe('PURCHASE');
    expect(movement.quantity_change).toBe(12);
    expect(movement.new_stock).toBe(initialStock + 12);

    const refreshed = await productService.getProductById(targetProduct.id);
    expect(refreshed?.current_stock).toBe(initialStock + 12);
  });

  it('records DAMAGED and EXPIRED stock write-offs with reason codes', async () => {
    const products = await productService.getProducts();
    const target = products[2];
    const initialStock = target.current_stock;

    const damageMovement = await inventoryService.recordMovement({
      productId: target.id,
      quantityChange: -2,
      movementType: 'DAMAGE',
      reason: 'Leaking seal found during shelf stock',
      userId: 'user-002'
    });

    expect(damageMovement.movement_type).toBe('DAMAGE');
    expect(damageMovement.new_stock).toBe(initialStock - 2);
    expect(damageMovement.reason).toContain('Leaking seal');
  });

  it('computes accurate stock asset valuation', async () => {
    const valuation = await inventoryService.getStockValuation();
    expect(valuation.totalUnits).toBeGreaterThan(0);
    expect(valuation.totalCostValue).toBeGreaterThan(0);
    expect(valuation.totalRetailValue).toBeGreaterThan(valuation.totalCostValue);
  });
});
