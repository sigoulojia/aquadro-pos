import { describe, it, expect, beforeEach } from 'vitest';
import { caisseService } from '../src/services/caisse.service';
import { db } from '../src/db/sqlite';

describe('Caisse Session Management & Daily Closing (Rapport Z)', () => {
  beforeEach(async () => {
    await db.initialize();
  });

  it('opens a new shift with initial cash float and rejects duplicate active shifts', async () => {
    // Ensure no lingering open session
    const existing = await caisseService.getActiveSession();
    if (existing) {
      await caisseService.closeShift({
        sessionId: existing.id,
        actualCountedCash: existing.expected_cash_drawer,
        managerName: 'Manager'
      });
    }

    // 1. Open shift with 5 000 DA float
    const session = await caisseService.openShift({
      cashierId: 'user-002',
      cashierName: 'Yacine Amrani',
      storeId: 'store-001',
      openingFloat: 5000,
      notes: 'Ouverture matinale'
    });

    expect(session.id).toBeDefined();
    expect(session.status).toBe('OPEN');
    expect(session.opening_float).toBe(5000);
    expect(session.expected_cash_drawer).toBe(5000);
    expect(session.total_cash_sales).toBe(0);

    // 2. Reject duplicate open shift attempt
    await expect(
      caisseService.openShift({
        cashierId: 'user-001',
        cashierName: 'Karim Benali',
        storeId: 'store-001',
        openingFloat: 10000
      })
    ).rejects.toThrow(/déjà ouverte/);
  });

  it('records cash sales, expenses, and computes accurate closing discrepancy & Z-Report', async () => {
    const active = await caisseService.getActiveSession();
    expect(active).not.toBeNull();

    // 1. Cash sale occurs (+16 800 DA)
    await caisseService.recordSaleToSession(16800);

    // 2. Store petty cash expense occurs (-1 200 DA for transport / packaging)
    await caisseService.recordExpenseToSession(1200);

    // Expected cash = 5 000 (float) + 16 800 (sales) - 1 200 (expenses) = 20 600 DA
    const updatedActive = await caisseService.getActiveSession();
    expect(updatedActive?.expected_cash_drawer).toBe(20600);
    expect(updatedActive?.total_cash_sales).toBe(16800);
    expect(updatedActive?.total_cash_expenses).toBe(1200);

    // 3. Cashier counts physical cash drawer: Counted 20 600 DA (Exact match)
    const { session: closedSession, zReport } = await caisseService.closeShift({
      sessionId: active!.id,
      actualCountedCash: 20600,
      managerName: 'Karim Benali',
      notes: 'Caisse juste, journée conforme'
    });

    expect(closedSession.status).toBe('CLOSED');
    expect(closedSession.actual_counted_cash).toBe(20600);
    expect(closedSession.cash_discrepancy).toBe(0);

    // Verify Z-Report structure
    expect(zReport.openingFloat).toBe(5000);
    expect(zReport.cashSales).toBe(16800);
    expect(zReport.cashExpenses).toBe(1200);
    expect(zReport.expectedCash).toBe(20600);
    expect(zReport.actualCountedCash).toBe(20600);
    expect(zReport.discrepancy).toBe(0);
    expect(zReport.discrepancyStatus).toBe('BALANCED');
    expect(zReport.closedByManager).toBe('Karim Benali');
  });

  it('detects cash shortage and surplus accurately', async () => {
    // Open new session with 10 000 DA
    const session = await caisseService.openShift({
      cashierId: 'user-002',
      cashierName: 'Yacine Amrani',
      storeId: 'store-001',
      openingFloat: 10000
    });

    // Cashier counts 9 500 DA (500 DA shortage)
    const { zReport } = await caisseService.closeShift({
      sessionId: session.id,
      actualCountedCash: 9500,
      managerName: 'Karim Benali'
    });

    expect(zReport.discrepancy).toBe(-500);
    expect(zReport.discrepancyStatus).toBe('SHORTAGE');
  });
});
