// Aquadro POS Algérie V2 — Service de Gestion des Dépenses & Charges du Magasin
// Saisie des charges (Sonelgaz, Loyer, Emballages, Transport) et impact direct sur la caisse

import { db } from '../db/sqlite';
import { Expense, ExpenseCategory } from '../types/database';
import { caisseService } from './caisse.service';

export interface CreateExpensePayload {
  category: ExpenseCategory;
  amount: number;
  paymentMethod: 'CASH' | 'BANK';
  description: string;
  date: string; // YYYY-MM-DD
  userId: string;
  userName?: string;
  sessionId?: string;
}

export class ExpenseService {
  private static instance: ExpenseService;

  private constructor() {}

  public static getInstance(): ExpenseService {
    if (!ExpenseService.instance) {
      ExpenseService.instance = new ExpenseService();
    }
    return ExpenseService.instance;
  }

  public async getExpenses(limit: number = 100): Promise<Expense[]> {
    return await db.select<Expense>(
      `SELECT * FROM expenses ORDER BY date DESC, created_at DESC LIMIT ${limit}`
    );
  }

  public async createExpense(payload: CreateExpensePayload): Promise<Expense> {
    if (payload.amount <= 0) {
      throw new Error('Le montant de la dépense doit être supérieur à zéro.');
    }
    if (!payload.description.trim()) {
      throw new Error('La description du motif de la charge est obligatoire.');
    }

    const expense: Expense = {
      id: `exp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      category: payload.category,
      amount: payload.amount,
      payment_method: payload.paymentMethod,
      description: payload.description.trim(),
      date: payload.date,
      user_id: payload.userId,
      user_name: payload.userName,
      created_at: new Date().toISOString()
    };

    await db.execute(
      `INSERT INTO expenses (
        id, category, amount, payment_method, description, date, user_id, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        expense.id, expense.category, expense.amount, expense.payment_method,
        expense.description, expense.date, expense.user_id, expense.created_at
      ]
    );

    // Si payé en espèces, déduire immédiatement du fond de la session de caisse active
    if (payload.paymentMethod === 'CASH') {
      const activeSession = payload.sessionId
        ? await caisseService.getSessionById(payload.sessionId)
        : await caisseService.getActiveSession();

      if (activeSession && activeSession.status === 'OPEN') {
        await caisseService.recordExpenseToSession(activeSession.id, payload.amount);
      }
    }

    return expense;
  }
}

export const expenseService = ExpenseService.getInstance();
