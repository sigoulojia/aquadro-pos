// Aquadro POS Algérie V2 — Service de Gestion des Ventes & Remboursements Contrôlés
// Historique immuable, réimpression et remboursements autorisés par code PIN Responsable

import { db } from '../db/sqlite';
import { Sale, SaleItem, Payment, Refund, RefundItem, Product } from '../types/database';
import { inventoryService } from './inventory.service';
import { caisseService } from './caisse.service';
import { CurrencyUtil } from '../core/currency/currency';

export interface ProcessRefundPayload {
  saleId: string;
  cashierId: string;
  cashierName: string;
  itemsToRefund: Array<{
    saleItemId: string;
    productId: string;
    quantity: number;
    unitPrice: number;
    unitPurchasePrice: number;
    restock: boolean;
  }>;
  reason: string;
  managerPin?: string;
  sessionId?: string;
}

export class SalesService {
  private static instance: SalesService;

  private constructor() {}

  public static getInstance(): SalesService {
    if (!SalesService.instance) {
      SalesService.instance = new SalesService();
    }
    return SalesService.instance;
  }

  public async getSales(limit: number = 100): Promise<Sale[]> {
    const sales = await db.select<Sale>(
      `SELECT * FROM sales ORDER BY created_at DESC LIMIT ${limit}`
    );
    const allItems = await db.select<SaleItem>('SELECT * FROM sale_items');
    const allPayments = await db.select<Payment>('SELECT * FROM payments');

    return sales.map(s => ({
      ...s,
      items: allItems.filter(i => i.sale_id === s.id),
      payments: allPayments.filter(p => p.sale_id === s.id)
    }));
  }

  public async getSaleById(saleId: string): Promise<Sale | null> {
    const sales = await db.select<Sale>('SELECT * FROM sales WHERE id = ?', [saleId]);
    if (sales.length === 0) return null;

    const sale = sales[0];
    const rawItems = await db.select<SaleItem>('SELECT * FROM sale_items WHERE sale_id = ?', [saleId]);
    sale.items = rawItems.map(i => ({
      ...i,
      unit_price: (i as any).unit_price || i.unit_price_ttc
    }));
    sale.payments = await db.select<Payment>('SELECT * FROM payments WHERE sale_id = ?', [saleId]);
    return sale;
  }

  // Traiter un retour / remboursement avec validation des quantités
  public async processRefund(payload: ProcessRefundPayload & { items?: any[] }): Promise<Refund> {
    const sale = await this.getSaleById(payload.saleId);
    if (!sale) {
      throw new Error(`Vente introuvable : ${payload.saleId}`);
    }

    const itemsToRefund = payload.items || payload.itemsToRefund || [];
    if (!itemsToRefund || itemsToRefund.length === 0) {
      throw new Error('Veuillez sélectionner au moins un article à rembourser.');
    }

    let totalRefundAmount = 0;
    const refundItemsList: RefundItem[] = [];
    const refundId = `ref-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const refundReceipt = `REF-AVO-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;
    const now = new Date().toISOString();

    for (const rItem of itemsToRefund) {
      const origItem = sale.items?.find(i => i.id === rItem.saleItemId);
      if (!origItem) {
        throw new Error(`Ligne de vente introuvable : ${rItem.saleItemId}`);
      }

      if (rItem.quantity > origItem.quantity) {
        throw new Error(
          `Quantité excessive : Vous ne pouvez pas rembourser ${rItem.quantity} unité(s) ` +
          `alors que seulement ${origItem.quantity} unité(s) ont été achetées.`
        );
      }

      const unitPrice = rItem.unitPrice !== undefined ? rItem.unitPrice : (rItem.refundPrice !== undefined ? rItem.refundPrice : origItem.unit_price_ttc);
      const lineRefund = CurrencyUtil.multiply(unitPrice, rItem.quantity);
      totalRefundAmount = CurrencyUtil.add(totalRefundAmount, lineRefund);

      const refundItem: RefundItem = {
        id: `refi-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        refund_id: refundId,
        sale_item_id: rItem.saleItemId,
        product_id: rItem.productId,
        product_name: origItem.product_name,
        quantity: rItem.quantity,
        refund_price: rItem.unitPrice,
        unit_purchase_price: origItem.unit_purchase_cost_snapshot,
        restock_inventory: rItem.restock ? 1 : 0
      };

      refundItemsList.push(refundItem);

      // Si réintégration en stock autorisée
      if (rItem.restock) {
        await inventoryService.recordMovement({
          productId: rItem.productId,
          batchId: origItem.batch_id,
          movementType: 'RETURN',
          quantityChange: rItem.quantity,
          reason: `Retour marchandise avoir ${refundReceipt} (Vente originale: ${sale.receipt_number})`,
          referenceId: refundReceipt,
          unitCostSnapshot: origItem.unit_purchase_cost_snapshot,
          userId: payload.cashierId,
          userName: payload.cashierName
        });
      }
    }

    const refund: Refund = {
      id: refundId,
      original_sale_id: sale.id,
      receipt_number: refundReceipt,
      cashier_id: payload.cashierId,
      cashier_name: payload.cashierName,
      refund_amount: totalRefundAmount,
      payment_method: sale.payments?.[0]?.payment_method || 'CASH',
      reason: payload.reason,
      authorized_by_pin: payload.managerPin,
      created_at: now,
      items: refundItemsList
    };

    // Insérer le remboursement dans SQLite
    await db.execute(
      `INSERT INTO refunds (
        id, original_sale_id, receipt_number, cashier_id, refund_amount,
        payment_method, reason, authorized_by_pin, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        refund.id, refund.original_sale_id, refund.receipt_number,
        refund.cashier_id, refund.refund_amount, refund.payment_method,
        refund.reason, refund.authorized_by_pin || null, refund.created_at
      ]
    );

    for (const ri of refundItemsList) {
      await db.execute(
        `INSERT INTO refund_items (
          id, refund_id, sale_item_id, product_id, quantity, refund_price,
          unit_purchase_price, restock_inventory
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          ri.id, ri.refund_id, ri.sale_item_id, ri.product_id, ri.quantity,
          ri.refund_price, ri.unit_purchase_price, ri.restock_inventory
        ]
      );
    }

    // Mettre à jour le statut de la vente originale
    const isFullRefund = totalRefundAmount >= sale.total_ttc;
    const newStatus = isFullRefund ? 'REFUNDED' : 'PARTIALLY_REFUNDED';
    await db.execute('UPDATE sales SET status = ? WHERE id = ?', [newStatus, sale.id]);

    // Si remboursé en espèces, déduire de la session de caisse
    if (refund.payment_method === 'CASH') {
      const activeSession = payload.sessionId
        ? await caisseService.getSessionById(payload.sessionId)
        : await caisseService.getActiveSession();

      if (activeSession && activeSession.status === 'OPEN') {
        await caisseService.recordRefundToSession(activeSession.id, totalRefundAmount);
      }
    }

    // Inscrire dans le journal d'audit légal
    await db.execute(
      `INSERT INTO audit_logs (
        id, user_id, user_name, action, entity_type, entity_id, details, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        `audit-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        payload.cashierId || 'system',
        payload.cashierName || 'Caissier',
        'PROCESS_REFUND',
        'SALE',
        sale.id,
        `Remboursement avoir ${refundReceipt} de ${totalRefundAmount} DA`,
        now
      ]
    );

    return refund;
  }
}

export const salesService = SalesService.getInstance();
