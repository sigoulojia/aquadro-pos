// Aquadro POS Algérie V2 — Service des Achats & Réceptions Fournisseurs
// Création des bons de commande, réception avec saisie de lot/expiration FEFO et mise à jour des stocks

import { db } from '../db/sqlite';
import { Purchase, PurchaseItem, Supplier, Product } from '../types/database';
import { inventoryService } from './inventory.service';
import { CurrencyUtil } from '../core/currency/currency';

export interface CreatePurchasePayload {
  supplierId: string;
  items: Array<{
    productId: string;
    productName: string;
    quantity: number;
    purchaseCost: number;
    batchNumber?: string;
    expirationDate?: string;
  }>;
}

export class PurchaseService {
  private static instance: PurchaseService;

  private constructor() {}

  public static getInstance(): PurchaseService {
    if (!PurchaseService.instance) {
      PurchaseService.instance = new PurchaseService();
    }
    return PurchaseService.instance;
  }

  public async getPurchases(): Promise<Purchase[]> {
    const list = await db.select<Purchase>('SELECT * FROM purchases ORDER BY ordered_at DESC');
    const suppliers = await db.select<Supplier>('SELECT id, name FROM suppliers');
    const supMap = new Map(suppliers.map(s => [s.id, s.name]));
    const allItems = await db.select<PurchaseItem>('SELECT * FROM purchase_items');

    return list.map(p => ({
      ...p,
      supplier_name: supMap.get(p.supplier_id) || 'Fournisseur inconnu',
      items: allItems.filter(item => item.purchase_id === p.id)
    }));
  }

  // Créer un bon de commande fournisseur
  public async createPurchase(payload: CreatePurchasePayload): Promise<Purchase> {
    if (!payload.items || payload.items.length === 0) {
      throw new Error('Veuillez ajouter au moins un article à la commande.');
    }

    const year = new Date().getFullYear();
    const purchaseId = `po-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const orderNumber = `PO-${year}-${Math.floor(100000 + Math.random() * 900000)}`;
    const now = new Date().toISOString();

    let totalCost = 0;
    for (const item of payload.items) {
      const lineCost = CurrencyUtil.multiply(item.purchaseCost, item.quantity);
      totalCost = CurrencyUtil.add(totalCost, lineCost);
    }

    const purchase: Purchase = {
      id: purchaseId,
      supplier_id: payload.supplierId,
      order_number: orderNumber,
      total_cost: totalCost,
      status: 'ORDERED',
      ordered_at: now
    };

    await db.execute(
      `INSERT INTO purchases (
        id, supplier_id, order_number, total_cost, status, ordered_at
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      [purchase.id, purchase.supplier_id, purchase.order_number, purchase.total_cost, purchase.status, purchase.ordered_at]
    );

    const itemsList: PurchaseItem[] = [];
    for (const item of payload.items) {
      const pItem: PurchaseItem = {
        id: `poi-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        purchase_id: purchaseId,
        product_id: item.productId,
        product_name: item.productName,
        quantity_ordered: item.quantity,
        quantity_received: 0,
        purchase_cost: item.purchaseCost,
        batch_number: item.batchNumber,
        expiration_date: item.expirationDate
      };

      await db.execute(
        `INSERT INTO purchase_items (
          id, purchase_id, product_id, quantity_ordered, quantity_received,
          purchase_cost, batch_number, expiration_date
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          pItem.id, pItem.purchase_id, pItem.product_id, pItem.quantity_ordered,
          pItem.quantity_received, pItem.purchase_cost, pItem.batch_number || null,
          pItem.expiration_date || null
        ]
      );

      itemsList.push(pItem);
    }

    purchase.items = itemsList;
    return purchase;
  }

  // Réception de marchandise (Goods Receipt) : Met à jour le stock et crée les lots FEFO
  public async receivePurchase(purchaseId: string, userId: string = 'user-001'): Promise<void> {
    const purchases = await db.select<Purchase>('SELECT * FROM purchases WHERE id = ?', [purchaseId]);
    if (purchases.length === 0) {
      throw new Error(`Bon de commande introuvable : ${purchaseId}`);
    }
    const po = purchases[0];
    if (po.status === 'RECEIVED') {
      throw new Error('Cette commande a déjà été réceptionnée.');
    }

    const items = await db.select<PurchaseItem>('SELECT * FROM purchase_items WHERE purchase_id = ?', [purchaseId]);
    const receivedAt = new Date().toISOString();

    for (const item of items) {
      let batchId: string | undefined;

      // 1. Si un lot et date d'expiration sont spécifiés, créer le lot FEFO
      if (item.batch_number && item.expiration_date) {
        batchId = `batch-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
        await db.execute(
          `INSERT INTO product_batches (
            id, product_id, batch_number, expiration_date, current_stock, purchase_cost, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [batchId, item.product_id, item.batch_number, item.expiration_date, item.quantity_ordered, item.purchase_cost, receivedAt]
        );
      }

      // 2. Mouvement de stock traçable
      await inventoryService.recordMovement({
        productId: item.product_id,
        batchId,
        movementType: 'PURCHASE',
        quantityChange: item.quantity_ordered,
        reason: `Réception bon de commande ${po.order_number}`,
        referenceId: po.order_number,
        unitCostSnapshot: item.purchase_cost,
        userId
      });

      // Mettre à jour l'article commandé comme reçu
      await db.execute('UPDATE purchase_items SET quantity_received = quantity_ordered WHERE id = ?', [item.id]);
    }

    // 3. Mettre à jour le solde dû au fournisseur
    const suppliers = await db.select<Supplier>('SELECT * FROM suppliers WHERE id = ?', [po.supplier_id]);
    if (suppliers.length > 0) {
      const sup = suppliers[0];
      const newBal = CurrencyUtil.add(sup.current_balance, po.total_cost);
      await db.execute('UPDATE suppliers SET current_balance = ? WHERE id = ?', [newBal, sup.id]);
    }

    // 4. Clôturer le bon de commande
    await db.execute("UPDATE purchases SET status = 'RECEIVED', received_at = ? WHERE id = ?", [receivedAt, purchaseId]);
  }
}

export const purchaseService = PurchaseService.getInstance();
