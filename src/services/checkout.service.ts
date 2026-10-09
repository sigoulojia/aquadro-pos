// Aquadro POS Algérie V2 — Service d'Encaissement & Intégrité Financière (CheckoutService)
// RÈGLE CRITIQUE : Snapshot immuable du coût d'achat, allocation FEFO, génération du numéro de ticket, déduction atomique.

import { db } from '../db/sqlite';
import { Sale, SaleItem, Payment, PaymentMethod } from '../types/database';
import { inventoryService } from './inventory.service';
import { caisseService } from './caisse.service';
import { CurrencyUtil } from '../core/currency/currency';
import { documentService } from './document.service';

export interface CheckoutItemInput {
  productId: string;
  name: string;
  sku?: string;
  quantity: number;
  unitPrice: number;     // Prix unitaire TTC
  discountAmount: number;// Remise unitaire
}

export interface PaymentInput {
  method: PaymentMethod;
  amount: number;
  tenderedAmount: number;
  changeGiven: number;
  tpeAuthReference?: string;
}

export interface ProcessCheckoutPayload {
  cashierId: string;
  cashierName: string;
  sessionId?: string;
  customerId?: string;
  customerName?: string;
  items: CheckoutItemInput[];
  payments: PaymentInput[];
  discountAmount?: number;
  notes?: string;
}

export class CheckoutService {
  private static instance: CheckoutService;

  private constructor() {}

  public static getInstance(): CheckoutService {
    if (!CheckoutService.instance) {
      CheckoutService.instance = new CheckoutService();
    }
    return CheckoutService.instance;
  }



  // Traitement atomique de l'encaissement (Délégué au Backend Rust en environnement Tauri)
  public async processCheckout(payload: ProcessCheckoutPayload): Promise<Sale> {
    if (!payload.items || payload.items.length === 0) {
      throw new Error('Le panier est vide. Impossible de finaliser la vente.');
    }

    const isTauri = typeof window !== 'undefined' && typeof (window as any).__TAURI_INTERNALS__?.invoke === 'function';

    if (isTauri) {
      const { invoke } = await import('@tauri-apps/api/core');

      const idempotencyKey = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      });

      // Préparation de la payload pour le Rust
      const rustPayload = {
        idempotencyKey: idempotencyKey,
        cashierId: payload.cashierId,
        sessionId: payload.sessionId || null,
        customerId: payload.customerId || null,
        items: payload.items.map(item => ({
          productId: item.productId,
          quantity: item.quantity,
          unitPriceTtc: Math.round(item.unitPrice),
          discountAmount: Math.round(item.discountAmount || 0)
        })),
        payments: payload.payments.map(p => ({
          paymentMethod: p.method,
          amount: Math.round(p.amount),
          tenderedAmount: Math.round(p.tenderedAmount)
        }))
      };

      try {
        const response: any = await invoke('process_checkout', { payload: rustPayload });
        
        return {
          id: response.sale_id,
          receipt_number: response.receipt_number,
          total_ttc: response.total_ttc,
          status: 'COMPLETED',
          session_id: payload.sessionId,
          cashier_id: payload.cashierId,
          cashier_name: payload.cashierName,
          customer_id: payload.customerId,
          customer_name: payload.customerName,
          created_at: new Date().toISOString(),
          items: [],
          payments: []
        } as unknown as Sale;
      } catch (err: any) {
        throw new Error(`Échec de l'encaissement: ${err}`);
      }
    }

    // --- Mode Hors-Tauri / Environnement de Tests Automatisés (Vitest/Node) ---
    // 1. Calcul des totaux
    let calculatedSubtotal = 0;
    for (const item of payload.items) {
      const lineTotal = CurrencyUtil.multiply(
        CurrencyUtil.subtract(item.unitPrice, item.discountAmount || 0),
        item.quantity
      );
      calculatedSubtotal = CurrencyUtil.add(calculatedSubtotal, lineTotal);
    }
    const globalDiscount = payload.discountAmount || 0;
    const finalTotalTTC = Math.max(0, CurrencyUtil.subtract(calculatedSubtotal, globalDiscount));

    // 2. Vérification des règlements
    const totalPaid = payload.payments.reduce((sum, p) => CurrencyUtil.add(sum, p.amount), 0);
    if (totalPaid < finalTotalTTC) {
      throw new Error(
        `Paiement insuffisant : Requis ${CurrencyUtil.formatDZD(finalTotalTTC)}, ` +
        `Versé ${CurrencyUtil.formatDZD(totalPaid)}.`
      );
    }

    const saleId = `sale-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const randSeq = Math.floor(1000 + Math.random() * 9000).toString();
    const internalRef = `REC-${dateStr}-${randSeq}`;

    // Enregistrer le document officiel (Ticket)
    const docRecord = await documentService.registerDocument({
      type: 'TICKET',
      referenceId: internalRef,
      customerOrSupplierName: payload.customerName || undefined,
      totalTtc: finalTotalTTC
    });
    
    const receiptNumber = internalRef;
    const idempotencyKey = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
    const createdAt = now.toISOString();

    // 3. Traiter chaque article selon FEFO et déduire le stock
    const saleItems: SaleItem[] = [];

    for (const item of payload.items) {
      // Allocation FEFO
      const allocation = await inventoryService.allocateFefoBatches(item.productId, item.quantity);

      for (const alloc of allocation.allocations) {
        const itemLineTotal = CurrencyUtil.multiply(
          CurrencyUtil.subtract(item.unitPrice, item.discountAmount || 0),
          alloc.quantityAllocated
        );

        const saleItem: SaleItem = {
          id: `item-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          sale_id: saleId,
          product_id: item.productId,
          product_name: item.name,
          sku: item.sku,
          batch_id: alloc.batchId !== 'default-batch' ? alloc.batchId : undefined,
          batch_number: alloc.batchNumber,
          quantity: alloc.quantityAllocated,
          unit_price_ttc: item.unitPrice,
          discount_amount: item.discountAmount || 0,
          total_ttc: itemLineTotal,
          unit_purchase_cost_snapshot: alloc.unitPurchaseCost,
          unit_purchase_price: alloc.unitPurchaseCost,
          unit_price: item.unitPrice,
          created_at: createdAt
        };

        saleItems.push(saleItem);

        if (alloc.batchId && alloc.batchId !== 'default-batch') {
          await inventoryService.decrementBatchStock(alloc.batchId, alloc.quantityAllocated);
        }

        await inventoryService.recordMovement({
          productId: item.productId,
          batchId: alloc.batchId !== 'default-batch' ? alloc.batchId : undefined,
          movementType: 'SALE',
          quantityChange: -alloc.quantityAllocated,
          reason: `Vente ${receiptNumber} (Lot: ${alloc.batchNumber})`,
          referenceId: receiptNumber,
          unitCostSnapshot: alloc.unitPurchaseCost,
          userId: payload.cashierId,
          userName: payload.cashierName
        });
      }
    }

    // 4. Enregistrer la vente principale dans SQLite
    const sale: Sale = {
      id: saleId,
      receipt_number: receiptNumber,
      session_id: payload.sessionId,
      cashier_id: payload.cashierId,
      cashier_name: payload.cashierName,
      customer_id: payload.customerId,
      customer_name: payload.customerName,
      subtotal_ht: calculatedSubtotal,
      discount_amount: globalDiscount,
      tax_amount: 0,
      total_ttc: finalTotalTTC,
      status: 'COMPLETED',
      idempotency_key: idempotencyKey,
      sync_status: 'PENDING',
      created_at: createdAt,
      items: saleItems,
      payments: []
    };

    await db.execute(
      `INSERT INTO sales (
        id, receipt_number, session_id, cashier_id, customer_id,
        subtotal_ht, discount_amount, tax_amount, total_ttc, status,
        idempotency_key, sync_status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        sale.id, sale.receipt_number, sale.session_id || null, sale.cashier_id,
        sale.customer_id || null, sale.subtotal_ht, sale.discount_amount,
        sale.tax_amount, sale.total_ttc, sale.status, sale.idempotency_key,
        sale.sync_status, sale.created_at
      ]
    );

    // 5. Insérer les lignes de vente
    for (const si of saleItems) {
      await db.execute(
        `INSERT INTO sale_items (
          id, sale_id, product_id, batch_id, quantity, unit_price_ttc,
          discount_amount, total_ttc, unit_purchase_cost_snapshot,
          unit_purchase_price, unit_price, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          si.id, si.sale_id, si.product_id, si.batch_id || null, si.quantity,
          si.unit_price_ttc, si.discount_amount, si.total_ttc,
          si.unit_purchase_cost_snapshot,
          si.unit_purchase_cost_snapshot, si.unit_price_ttc, si.created_at
        ]
      );
    }

    // 6. Insérer les paiements et mettre à jour la session de caisse
    const paymentsList: Payment[] = [];
    for (const p of payload.payments) {
      const payment: Payment = {
        id: `pay-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        sale_id: saleId,
        payment_method: p.method,
        amount: p.amount,
        tendered_amount: p.tenderedAmount,
        change_given: p.changeGiven,
        tpe_auth_reference: p.tpeAuthReference,
        created_at: createdAt
      };

      await db.execute(
        `INSERT INTO payments (
          id, sale_id, payment_method, amount, tendered_amount,
          change_given, tpe_auth_reference, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          payment.id, payment.sale_id, payment.payment_method, payment.amount,
          payment.tendered_amount, payment.change_given, payment.tpe_auth_reference || null,
          payment.created_at
        ]
      );

      paymentsList.push(payment);

      if (payload.sessionId) {
        await caisseService.recordSaleToSession(payload.sessionId, p.amount, p.method);
      }
    }

    sale.payments = paymentsList;

    if (payload.customerId) {
      const custs = await db.select<any>('SELECT * FROM customers WHERE id = ?', [payload.customerId]);
      if (custs.length > 0) {
        const c = custs[0];
        const pointsEarned = Math.floor(finalTotalTTC / 100);
        const newPoints = (c.loyalty_points || 0) + pointsEarned;
        const newSpent = CurrencyUtil.add(c.total_spent || 0, finalTotalTTC);
        
        let newDebt = c.current_debt || 0;
        const creditPayment = payload.payments.find(p => p.method === 'CREDIT');
        if (creditPayment) {
          newDebt = CurrencyUtil.add(newDebt, creditPayment.amount);
        }

        await db.execute(
          'UPDATE customers SET loyalty_points = ?, total_spent = ?, current_debt = ? WHERE id = ?',
          [newPoints, newSpent, newDebt, c.id]
        );
      }
    }

    await db.execute(
      `INSERT INTO sync_operations (
        id, table_name, record_id, action, payload, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        `sync-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        'sales',
        sale.id,
        'INSERT',
        JSON.stringify({ sale, items: saleItems, payments: paymentsList }),
        'PENDING',
        createdAt
      ]
    );

    return sale;
  }

  // Compatibilité tests et workflows tiers
  public async completeSale(
    cart: any,
    payments: PaymentInput[],
    cashierId: string = 'usr-csh-01',
    cashierName: string = 'Caissier',
    store?: any,
    customer?: any
  ): Promise<{ sale: Sale & { total_amount: number }; changeGiven: number }> {
    const rawItems = cart.items || cart || [];
    const items: CheckoutItemInput[] = rawItems.map((i: any) => ({
      productId: i.product_id || i.productId || i.id,
      name: i.name || i.product_name || 'Article',
      sku: i.sku,
      quantity: i.quantity || 1,
      unitPrice: i.unit_price || i.unitPrice || i.selling_price || 0,
      discountAmount: i.discount_amount || i.discountAmount || 0
    }));

    const attachedCustomer = customer || cart.customer;
    const sale = await this.processCheckout({
      cashierId,
      cashierName,
      customerId: attachedCustomer?.id,
      customerName: attachedCustomer?.name,
      items,
      payments
    });

    const totalChange = payments.reduce((sum, p) => CurrencyUtil.add(sum, p.changeGiven || 0), 0);
    const saleResult: any = {
      ...sale,
      total_amount: sale.total_ttc
    };

    return { sale: saleResult, changeGiven: totalChange };
  }
}

export const checkoutService = CheckoutService.getInstance();
