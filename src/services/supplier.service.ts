// Aquadro POS Algérie V2 — Service Fournisseurs & Suivi des Dettes Distributeurs
// Gestion des grossistes et importateurs agréés de suppléments en Algérie

import { db } from '../db/sqlite';
import { Supplier, SupplierPayment } from '../types/database';
import { CurrencyUtil } from '../core/currency/currency';

export class SupplierService {
  private static instance: SupplierService;

  private constructor() {}

  public static getInstance(): SupplierService {
    if (!SupplierService.instance) {
      SupplierService.instance = new SupplierService();
    }
    return SupplierService.instance;
  }

  public async getSuppliers(): Promise<Supplier[]> {
    return await db.select<Supplier>('SELECT * FROM suppliers ORDER BY name ASC');
  }

  public async createSupplier(data: {
    name: string;
    contact_person?: string;
    phone?: string;
    email?: string;
    rc_number?: string;
    nif_number?: string;
  }): Promise<Supplier> {
    const supplier: Supplier = {
      id: `sup-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: data.name.trim(),
      contact_person: data.contact_person?.trim(),
      phone: data.phone?.trim(),
      email: data.email?.trim(),
      rc_number: data.rc_number?.trim(),
      nif_number: data.nif_number?.trim(),
      current_balance: 0.0,
      created_at: new Date().toISOString()
    };

    await db.execute(
      `INSERT INTO suppliers (
        id, name, contact_person, phone, email, rc_number, nif_number, current_balance, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        supplier.id, supplier.name, supplier.contact_person || null, supplier.phone || null,
        supplier.email || null, supplier.rc_number || null, supplier.nif_number || null,
        supplier.current_balance, supplier.created_at
      ]
    );

    return supplier;
  }

  public async updateSupplier(id: string, updates: Partial<Supplier>): Promise<void> {
    const fields: string[] = [];
    const values: any[] = [];

    for (const [key, val] of Object.entries(updates)) {
      if (key !== 'id' && key !== 'created_at') {
        fields.push(`${key} = ?`);
        values.push(val);
      }
    }

    if (fields.length === 0) return;
    values.push(id);

    await db.execute(`UPDATE suppliers SET ${fields.join(', ')} WHERE id = ?`, values);
  }

  // Enregistrer un règlement versé à un fournisseur
  public async recordSupplierPayment(payload: {
    supplierId: string;
    amount: number;
    paymentMethod: 'CASH' | 'CHECK' | 'TRANSFER';
    reference?: string;
    cashierId: string;
  }): Promise<SupplierPayment> {
    const suppliers = await db.select<Supplier>('SELECT * FROM suppliers WHERE id = ?', [payload.supplierId]);
    if (suppliers.length === 0) {
      throw new Error(`Fournisseur introuvable : ${payload.supplierId}`);
    }
    const sup = suppliers[0];

    const newBalance = Math.max(0, CurrencyUtil.subtract(sup.current_balance, payload.amount));
    await db.execute('UPDATE suppliers SET current_balance = ? WHERE id = ?', [newBalance, sup.id]);

    const payment: SupplierPayment = {
      id: `sp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      supplier_id: sup.id,
      supplier_name: sup.name,
      amount: payload.amount,
      payment_method: payload.paymentMethod,
      reference: payload.reference,
      cashier_id: payload.cashierId,
      created_at: new Date().toISOString()
    };

    await db.execute(
      `INSERT INTO supplier_payments (
        id, supplier_id, amount, payment_method, reference, cashier_id, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        payment.id, payment.supplier_id, payment.amount, payment.payment_method,
        payment.reference || null, payment.cashier_id, payment.created_at
      ]
    );

    return payment;
  }
}

export const supplierService = SupplierService.getInstance();
