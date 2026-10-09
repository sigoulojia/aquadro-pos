import { describe, it, expect, beforeEach } from 'vitest';
import { syncService } from '../src/services/sync.service';
import { db } from '../src/db/sqlite';

describe('Offline-First Synchronization Engine', () => {
  beforeEach(async () => {
    await db.initialize();
  });

  it('tracks pending outbox operations and executes idempotent sync', async () => {
    // 1. Insert a pending sync operation directly
    const opId = 'sync-test-' + Math.random().toString(36).substring(2, 9);
    await db.execute(
      `INSERT INTO sync_operations (id, table_name, record_id, action, payload, status, retry_count, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [opId, 'sales', 'sale-test-999', 'INSERT', JSON.stringify({ saleId: 'sale-test-999' }), 'PENDING', 0, new Date().toISOString()]
    );

    // 2. Check pending count
    const pendingCount = await syncService.checkPendingCount();
    expect(pendingCount).toBeGreaterThan(0);

    // 3. Trigger sync
    const syncResult = await syncService.triggerSync();
    expect(syncResult.success).toBe(true);
    expect(syncResult.syncedCount).toBeGreaterThan(0);

    // 4. Verify status updated to SYNCED
    const updatedOps = await db.select('SELECT * FROM sync_operations WHERE id = ?', [opId]);
    expect(updatedOps[0].status).toBe('SYNCED');
    expect(updatedOps[0].synced_at).toBeDefined();

    // 5. Subsequent sync with empty outbox completes cleanly
    const secondSync = await syncService.triggerSync();
    expect(secondSync.success).toBe(true);
    expect(secondSync.syncedCount).toBe(0);
  });
});
