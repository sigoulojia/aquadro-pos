// Aquadro POS Algérie V2 — Service Clients & Gestion des Crédits / Dettes Locales
// Suivi des athlètes, du solde débiteur et versement d'acomptes en DZD

import { db } from '../db/sqlite';
import { Customer, CustomerPayment, PaymentMethod } from '../types/database';
import { CurrencyUtil } from '../core/currency/currency';

export class CustomerService {
  private static instance: CustomerService;

  private constructor() {}

  public static getInstance(): CustomerService {
    if (!CustomerService.instance) {
      CustomerService.instance = new CustomerService();
    }
    return CustomerService.instance;
  }

  public async getCustomers(): Promise<Customer[]> {
    return await db.select<Customer>('SELECT * FROM customers ORDER BY name ASC');
  }

  public async getCustomerById(id: string): Promise<Customer | null> {
    const customers = await db.select<Customer>('SELECT * FROM customers WHERE id = ?', [id]);
    return customers.length > 0 ? customers[0] : null;
  }

  public async createCustomer(data: {
    name: string;
    phone?: string;
    wilaya?: string;
    notes?: string;
    credit_limit?: number;
  }): Promise<Customer> {
    const customer: Customer = {
      id: `cust-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: data.name.trim(),
      phone: data.phone?.trim(),
      wilaya: data.wilaya?.trim() || '16 - Alger',
      notes: data.notes?.trim(),
      credit_limit: data.credit_limit || 20000.0,
      current_debt: 0.0,
      loyalty_points: 0,
      created_at: new Date().toISOString()
    };

    await db.execute(
      `INSERT INTO customers (
        id, name, phone, wilaya, notes, credit_limit, current_debt, loyalty_points, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        customer.id, customer.name, customer.phone || null, customer.wilaya || null,
        customer.notes || null, customer.credit_limit, customer.current_debt,
        customer.loyalty_points, customer.created_at
      ]
    );

    return customer;
  }

  public async updateCustomer(id: string, updates: Partial<Customer>): Promise<void> {
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

    await db.execute(`UPDATE customers SET ${fields.join(', ')} WHERE id = ?`, values);
  }

  // Versement d'un acompte / règlement de dette par le client
  public async recordCreditPayment(payload: {
    customerId: string;
    amount: number;
    paymentMethod: PaymentMethod;
    cashierId: string;
    reference?: string;
  }): Promise<CustomerPayment> {
    const customers = await db.select<Customer>('SELECT * FROM customers WHERE id = ?', [payload.customerId]);
    if (customers.length === 0) {
      throw new Error(`Client introuvable : ${payload.customerId}`);
    }
    const cust = customers[0];

    if (payload.amount <= 0) {
      throw new Error('Le montant du versement doit être supérieur à zéro.');
    }

    const newDebt = Math.max(0, CurrencyUtil.subtract(cust.current_debt, payload.amount));
    await db.execute('UPDATE customers SET current_debt = ? WHERE id = ?', [newDebt, cust.id]);

    const payment: CustomerPayment = {
      id: `cp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      customer_id: cust.id,
      customer_name: cust.name,
      amount: payload.amount,
      payment_method: payload.paymentMethod,
      reference: payload.reference,
      cashier_id: payload.cashierId,
      created_at: new Date().toISOString()
    };

    await db.execute(
      `INSERT INTO customer_payments (
        id, customer_id, amount, payment_method, reference, cashier_id, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        payment.id, payment.customer_id, payment.amount, payment.payment_method,
        payment.reference || null, payment.cashier_id, payment.created_at
      ]
    );

    return payment;
  }
}

export const customerService = CustomerService.getInstance();
