// Aquadro POS Algérie V2 — Service d'Inventaire, FEFO & Traçabilité des Mouvements
// Gère l'allocation FEFO, la détection des péremptions et l'auditabilité des stocks

import { db } from '../db/sqlite';
import { Product, ProductBatch, InventoryMovement, MovementType } from '../types/database';
import { FefoEngine, FefoAllocationResult } from '../core/fefo/fefo';

export interface RecordMovementPayload {
  productId: string;
  batchId?: string;
  movementType: MovementType;
  quantityChange: number;
  reason: string;
  referenceId?: string;
  unitCostSnapshot?: number;
  userId: string;
  userName?: string;
}

export class InventoryService {
  private static instance: InventoryService;

  private constructor() {}

  public static getInstance(): InventoryService {
    if (!InventoryService.instance) {
      InventoryService.instance = new InventoryService();
    }
    return InventoryService.instance;
  }

  // Récupérer tous les lots d'un produit
  public async getProductBatches(productId: string): Promise<ProductBatch[]> {
    return await db.select<ProductBatch>(
      'SELECT * FROM product_batches WHERE product_id = ? ORDER BY expiration_date ASC',
      [productId]
    );
  }

  // Allouer les lots d'un produit selon FEFO
  public async allocateFefoBatches(productId: string, requestedQty: number): Promise<any> {
    const batches = await this.getProductBatches(productId);
    const products = await db.select<Product>('SELECT * FROM products WHERE id = ?', [productId]);
    if (products.length === 0) {
      throw new Error(`Produit introuvable : ${productId}`);
    }
    const product = products[0];

    let fefoResult: FefoAllocationResult;
    // Si le produit n'a pas de lot spécifique, créer ou utiliser un lot générique
    if (batches.length === 0) {
      if (product.current_stock < requestedQty) {
        throw new Error(`Stock insuffisant pour ${product.name_fr || (product as any).name} : ${product.current_stock} disponible(s), ${requestedQty} demandée(s).`);
      }
      const cost = product.purchase_cost !== undefined ? product.purchase_cost : ((product as any).purchase_price || 0);
      fefoResult = {
        allocations: [{
          batchId: 'default-batch',
          batchNumber: product.barcode || 'STD-LOT',
          expirationDate: '2028-12-31',
          quantityAllocated: requestedQty,
          unitPurchaseCost: cost
        }],
        totalAllocated: requestedQty,
        remainingRequested: 0
      };
    } else {
      fefoResult = FefoEngine.allocateStock(batches, requestedQty);
    }

    const items = fefoResult.allocations.map(a => ({
      batchId: a.batchId,
      batchNumber: a.batchNumber,
      expirationDate: a.expirationDate,
      quantity: a.quantityAllocated,
      quantityAllocated: a.quantityAllocated,
      purchasePrice: a.unitPurchaseCost,
      unitPurchaseCost: a.unitPurchaseCost
    }));

    return Object.assign(items, {
      allocations: fefoResult.allocations,
      totalAllocated: fefoResult.totalAllocated,
      remainingRequested: fefoResult.remainingRequested
    });
  }

  // Décrémenter le stock d'un lot et du produit atomiquement
  public async decrementBatchStock(batchId: string, quantity: number): Promise<void> {
    const batches = await db.select<ProductBatch>('SELECT * FROM product_batches WHERE id = ?', [batchId]);
    if (batches.length > 0) {
      const b = batches[0];
      const newBatchStock = Math.max(0, b.current_stock - quantity);
      await db.execute('UPDATE product_batches SET current_stock = ? WHERE id = ?', [newBatchStock, batchId]);
    }
  }

  // Enregistrer un mouvement de stock auditable
  public async recordMovement(payload: RecordMovementPayload): Promise<InventoryMovement> {
    const products = await db.select<Product>('SELECT * FROM products WHERE id = ?', [payload.productId]);
    if (products.length === 0) {
      throw new Error(`Produit introuvable : ${payload.productId}`);
    }
    const prod = products[0];
    const prevStock = prod.current_stock;
    const newStock = Math.max(0, prevStock + payload.quantityChange);

    // Mettre à jour le stock global du produit
    await db.execute('UPDATE products SET current_stock = ? WHERE id = ?', [newStock, prod.id]);

    // Si un batch est spécifié et que c'est un achat ou une sortie spécifique
    if (payload.batchId) {
      const batches = await db.select<ProductBatch>('SELECT * FROM product_batches WHERE id = ?', [payload.batchId]);
      if (batches.length > 0) {
        const b = batches[0];
        const newBatchStock = Math.max(0, b.current_stock + payload.quantityChange);
        await db.execute('UPDATE product_batches SET current_stock = ? WHERE id = ?', [newBatchStock, b.id]);
      }
    }

    const movement: InventoryMovement = {
      id: `mov-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      product_id: prod.id,
      product_name: prod.name_fr,
      batch_id: payload.batchId,
      movement_type: payload.movementType,
      quantity_change: payload.quantityChange,
      previous_stock: prevStock,
      new_stock: newStock,
      reference_id: payload.referenceId,
      reason: payload.reason,
      unit_cost_snapshot: payload.unitCostSnapshot ?? prod.purchase_cost,
      user_id: payload.userId,
      user_name: payload.userName,
      created_at: new Date().toISOString()
    };

    await db.execute(
      `INSERT INTO inventory_movements (
        id, product_id, batch_id, movement_type, quantity_change,
        previous_stock, new_stock, reference_id, reason, unit_cost_snapshot,
        user_id, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        movement.id, movement.product_id, movement.batch_id, movement.movement_type,
        movement.quantity_change, movement.previous_stock, movement.new_stock,
        movement.reference_id, movement.reason, movement.unit_cost_snapshot,
        movement.user_id, movement.created_at
      ]
    );

    return movement;
  }

  // Consulter l'historique des mouvements
  public async getRecentMovements(limit: number = 50): Promise<InventoryMovement[]> {
    return await db.select<InventoryMovement>(
      `SELECT * FROM inventory_movements ORDER BY created_at DESC LIMIT ${limit}`
    );
  }

  // Articles arrivant à péremption imminente
  public async getExpiringSoonBatches(daysThreshold: number = 60): Promise<Array<ProductBatch & { product_name: string }>> {
    const batches = await db.select<ProductBatch>('SELECT * FROM product_batches WHERE current_stock > 0 ORDER BY expiration_date ASC');
    const products = await db.select<Product>('SELECT id, name_fr FROM products');
    const prodMap = new Map(products.map(p => [p.id, p.name_fr]));

    return batches
      .filter(b => FefoEngine.isExpiringSoon(b.expiration_date, daysThreshold))
      .map(b => ({
        ...b,
        product_name: prodMap.get(b.product_id) || 'Article inconnu'
      }));
  }

  // Articles en alerte stock faible ou rupture
  public async getLowStockProducts(): Promise<Product[]> {
    const products = await db.select<Product>('SELECT * FROM products WHERE is_active = 1');
    return products.filter(p => p.current_stock <= p.min_stock_alert);
  }

  // Évaluation de la valeur marchande du stock (Valorisation)
  public async getStockValuation(): Promise<{ totalUnits: number; totalCostValue: number; totalRetailValue: number }> {
    const products = await db.select<Product>('SELECT * FROM products WHERE is_active = 1');
    let totalUnits = 0;
    let totalCostValue = 0;
    let totalRetailValue = 0;

    for (const p of products) {
      const stock = p.current_stock || 0;
      totalUnits += stock;
      totalCostValue += stock * (p.purchase_cost || 0);
      totalRetailValue += stock * (p.selling_price_ttc || 0);
    }

    return { totalUnits, totalCostValue, totalRetailValue };
  }
}

export const inventoryService = InventoryService.getInstance();
