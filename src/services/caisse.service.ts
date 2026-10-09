// Aquadro POS Algérie V2 — Service de Gestion de Caisse & Clôture Journalière (Rapport Z)
// Traçabilité des espèces, contrôle des écarts (Surplus / Déficit) et clôture conforme

import { db } from '../db/sqlite';
import { CashSession } from '../types/database';
import { CurrencyUtil } from '../core/currency/currency';

export interface OpenShiftPayload {
  cashierId: string;
  cashierName: string;
  openingFloat: number; // Fond de roulement en DZD
}

export interface CloseShiftPayload {
  sessionId: string;
  actualCountedCash: number; // Espèces physiques recomptées
  closingNotes?: string;
  managerName?: string;
}

export interface ZReportSummary {
  session: CashSession;
  totalRevenue: number;
  paymentBreakdown: {
    cash: number;
    cib: number;
    edahabia: number;
    baridimob: number;
    credit: number;
  };
  cashInDrawerExpected: number;
  cashInDrawerCounted: number;
  discrepancy: number;
  discrepancyStatus: 'BALANCED' | 'SURPLUS' | 'SHORTAGE';
  generatedAt: string;
}

export class CaisseService {
  private static instance: CaisseService;

  private constructor() {}

  public static getInstance(): CaisseService {
    if (!CaisseService.instance) {
      CaisseService.instance = new CaisseService();
    }
    return CaisseService.instance;
  }

  // Récupérer la session active
  public async getActiveSession(): Promise<CashSession | null> {
    const sessions = await db.select<CashSession>(
      "SELECT * FROM cash_sessions WHERE status = 'OPEN' ORDER BY opened_at DESC LIMIT 1"
    );
    return sessions.length > 0 ? sessions[0] : null;
  }

  // Ouvrir une nouvelle session de caisse
  public async openShift(payload: OpenShiftPayload): Promise<CashSession> {
    const existing = await this.getActiveSession();
    if (existing) {
      throw new Error(
        `Une session de caisse est déjà ouverte (ID: ${existing.id.substring(0, 8)}) par ${existing.cashier_name}. ` +
        `Veuillez clôturer la session active avant d'en ouvrir une nouvelle.`
      );
    }

    if (payload.openingFloat < 0) {
      throw new Error('Le fond de caisse initial ne peut pas être négatif.');
    }

    const session: CashSession = {
      id: `cs-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      cashier_id: payload.cashierId,
      cashier_name: payload.cashierName,
      opened_at: new Date().toISOString(),
      status: 'OPEN',
      opening_float: payload.openingFloat,
      total_cash_sales: 0,
      total_card_sales: 0,
      total_qr_sales: 0,
      total_credit_sales: 0,
      total_cash_refunds: 0,
      total_cash_expenses: 0,
      expected_cash_drawer: payload.openingFloat
    };

    await db.execute(
      `INSERT INTO cash_sessions (
        id, cashier_id, cashier_name, opened_at, status, opening_float,
        total_cash_sales, total_card_sales, total_qr_sales, total_credit_sales,
        total_cash_refunds, total_cash_expenses, expected_cash_drawer
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        session.id, session.cashier_id, session.cashier_name, session.opened_at,
        session.status, session.opening_float, session.total_cash_sales, session.total_card_sales,
        session.total_qr_sales, session.total_credit_sales, session.total_cash_refunds,
        session.total_cash_expenses, session.expected_cash_drawer
      ]
    );

    return session;
  }

  // Enregistrer une vente dans la session active
  public async recordSaleToSession(
    sessionIdOrAmount: string | number,
    amount?: number,
    paymentMethod: 'CASH' | 'CIB' | 'EDAHABIA' | 'BARIDIMOB' | 'CREDIT' = 'CASH'
  ): Promise<void> {
    let sessionId: string;
    let actualAmount: number;
    let actualMethod = paymentMethod;

    if (typeof sessionIdOrAmount === 'number') {
      const active = await this.getActiveSession();
      if (!active) return;
      sessionId = active.id;
      actualAmount = sessionIdOrAmount;
    } else {
      sessionId = sessionIdOrAmount;
      actualAmount = amount || 0;
    }

    const session = await this.getSessionById(sessionId);
    if (!session || session.status !== 'OPEN') return;

    let totalCashSales = session.total_cash_sales;
    let totalCardSales = session.total_card_sales;
    let totalQrSales = session.total_qr_sales;
    let totalCreditSales = session.total_credit_sales;

    if (actualMethod === 'CASH') {
      totalCashSales = CurrencyUtil.add(totalCashSales, actualAmount);
    } else if (actualMethod === 'CIB' || actualMethod === 'EDAHABIA') {
      totalCardSales = CurrencyUtil.add(totalCardSales, actualAmount);
    } else if (actualMethod === 'BARIDIMOB') {
      totalQrSales = CurrencyUtil.add(totalQrSales, actualAmount);
    } else if (actualMethod === 'CREDIT') {
      totalCreditSales = CurrencyUtil.add(totalCreditSales, actualAmount);
    }

    // Tiroir = Fond initial + Espèces encaissées - Remboursements espèces - Dépenses espèces
    const expectedDrawer = CurrencyUtil.subtract(
      CurrencyUtil.add(session.opening_float, totalCashSales),
      CurrencyUtil.add(session.total_cash_refunds, session.total_cash_expenses)
    );

    await db.execute(
      `UPDATE cash_sessions SET
        total_cash_sales = ?, total_card_sales = ?, total_qr_sales = ?,
        total_credit_sales = ?, expected_cash_drawer = ?
      WHERE id = ?`,
      [totalCashSales, totalCardSales, totalQrSales, totalCreditSales, expectedDrawer, sessionId]
    );
  }

  // Enregistrer une dépense magasin payée en espèces
  public async recordExpenseToSession(
    sessionIdOrAmount: string | number,
    expenseAmount?: number
  ): Promise<void> {
    let sessionId: string;
    let actualExpense: number;

    if (typeof sessionIdOrAmount === 'number') {
      const active = await this.getActiveSession();
      if (!active) return;
      sessionId = active.id;
      actualExpense = sessionIdOrAmount;
    } else {
      sessionId = sessionIdOrAmount;
      actualExpense = expenseAmount || 0;
    }

    const session = await this.getSessionById(sessionId);
    if (!session || session.status !== 'OPEN') return;

    const newExpenses = CurrencyUtil.add(session.total_cash_expenses, actualExpense);
    const expectedDrawer = CurrencyUtil.subtract(
      CurrencyUtil.add(session.opening_float, session.total_cash_sales),
      CurrencyUtil.add(session.total_cash_refunds, newExpenses)
    );

    await db.execute(
      `UPDATE cash_sessions SET total_cash_expenses = ?, expected_cash_drawer = ? WHERE id = ?`,
      [newExpenses, expectedDrawer, sessionId]
    );
  }

  // Enregistrer un remboursement en espèces
  public async recordRefundToSession(sessionId: string, refundAmount: number): Promise<void> {
    const session = await this.getSessionById(sessionId);
    if (!session || session.status !== 'OPEN') return;

    const newRefunds = CurrencyUtil.add(session.total_cash_refunds, refundAmount);
    const expectedDrawer = CurrencyUtil.subtract(
      CurrencyUtil.add(session.opening_float, session.total_cash_sales),
      CurrencyUtil.add(newRefunds, session.total_cash_expenses)
    );

    await db.execute(
      `UPDATE cash_sessions SET total_cash_refunds = ?, expected_cash_drawer = ? WHERE id = ?`,
      [newRefunds, expectedDrawer, sessionId]
    );
  }

  // Clôturer la session de caisse
  public async closeShift(payload: CloseShiftPayload & { notes?: string }): Promise<CashSession & { session: CashSession; zReport: any }> {
    const session = await this.getSessionById(payload.sessionId);
    if (!session) {
      throw new Error(`Session introuvable : ${payload.sessionId}`);
    }
    if (session.status === 'CLOSED') {
      throw new Error('Cette session est déjà clôturée.');
    }

    const counted = payload.actualCountedCash;
    const expected = session.expected_cash_drawer;
    const discrepancy = CurrencyUtil.subtract(counted, expected);
    const closedAt = new Date().toISOString();

    await db.execute(
      `UPDATE cash_sessions SET
        status = 'CLOSED',
        closed_at = ?,
        actual_counted_cash = ?,
        cash_discrepancy = ?,
        closing_notes = ?,
        closed_by_manager_name = ?
      WHERE id = ?`,
      [
        closedAt,
        counted,
        discrepancy,
        payload.notes || payload.closingNotes || '',
        payload.managerName || session.cashier_name,
        session.id
      ]
    );

    const updated = await this.getSessionById(payload.sessionId);
    const closedSession = updated!;

    let discrepancyStatus: 'BALANCED' | 'SURPLUS' | 'SHORTAGE' = 'BALANCED';
    if (discrepancy > 0) discrepancyStatus = 'SURPLUS';
    else if (discrepancy < 0) discrepancyStatus = 'SHORTAGE';

    const zReport = {
      openingFloat: closedSession.opening_float,
      cashSales: closedSession.total_cash_sales,
      cashExpenses: closedSession.total_cash_expenses,
      expectedCash: closedSession.expected_cash_drawer,
      actualCountedCash: counted,
      discrepancy: discrepancy,
      discrepancyStatus: discrepancyStatus,
      closedByManager: payload.managerName || closedSession.cashier_name
    };

    return Object.assign(closedSession, {
      session: closedSession,
      zReport: zReport
    });
  }

  // Données du Rapport Z (ou Rapport de Clôture)
  public async getZReportData(sessionId: string): Promise<ZReportSummary> {
    const session = await this.getSessionById(sessionId);
    if (!session) {
      throw new Error(`Session introuvable : ${sessionId}`);
    }

    const disc = session.cash_discrepancy || 0;
    let discrepancyStatus: 'BALANCED' | 'SURPLUS' | 'SHORTAGE' = 'BALANCED';
    if (disc > 0) discrepancyStatus = 'SURPLUS';
    else if (disc < 0) discrepancyStatus = 'SHORTAGE';

    const totalRevenue = CurrencyUtil.add(
      CurrencyUtil.add(session.total_cash_sales, session.total_card_sales),
      CurrencyUtil.add(session.total_qr_sales, session.total_credit_sales)
    );

    return {
      session,
      totalRevenue,
      paymentBreakdown: {
        cash: session.total_cash_sales,
        cib: session.total_card_sales,
        edahabia: 0, // Inclus dans card_sales ou ventilable
        baridimob: session.total_qr_sales,
        credit: session.total_credit_sales
      },
      cashInDrawerExpected: session.expected_cash_drawer,
      cashInDrawerCounted: session.actual_counted_cash ?? session.expected_cash_drawer,
      discrepancy: disc,
      discrepancyStatus,
      generatedAt: new Date().toISOString()
    };
  }

  public async getSessionById(id: string): Promise<CashSession | null> {
    const sessions = await db.select<CashSession>(
      'SELECT * FROM cash_sessions WHERE id = ? LIMIT 1',
      [id]
    );
    return sessions.length > 0 ? sessions[0] : null;
  }

  public async getAllSessions(limit: number = 30): Promise<CashSession[]> {
    return await db.select<CashSession>(
      `SELECT * FROM cash_sessions ORDER BY opened_at DESC LIMIT ${limit}`
    );
  }
}

export const caisseService = CaisseService.getInstance();
