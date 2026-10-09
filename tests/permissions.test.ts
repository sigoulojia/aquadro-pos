import { describe, it, expect, beforeEach } from 'vitest';
import { authService } from '../src/services/auth.service';
import { User } from '../src/types/database';
import { db } from '../src/db/sqlite';
import { SecurityUtil } from '../src/utils/security';

describe('Role-Based Access Control (RBAC) & PIN Security', () => {
  beforeEach(async () => {
    await db.initialize();
  });

  it('enforces cashier permissions restrictions strictly', async () => {
    const cashier: User = {
      id: 'test-cashier',
      store_id: 'store-01',
      role_id: 'role-cashier',
      role: 'cashier',
      name: 'Test Cashier',
      email: 'cashier@test.com',
      pin_hash: 'mock-pin-hash',
      is_active: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Allowed for cashier
    expect(authService.hasPermission('pos.checkout', cashier)).toBe(true);
    expect(authService.hasPermission('sales.view', cashier)).toBe(true);

    // Strictly forbidden for cashier
    expect(authService.hasPermission('products.view_cost', cashier)).toBe(false);
    expect(authService.hasPermission('inventory.adjust', cashier)).toBe(false);
    expect(authService.hasPermission('reports.view', cashier)).toBe(false);
    expect(authService.hasPermission('users.manage', cashier)).toBe(false);
    expect(authService.hasPermission('settings.manage', cashier)).toBe(false);
  });

  it('grants store manager elevated privileges for refunds and inventory write-offs', () => {
    const manager: User = {
      id: 'test-manager',
      store_id: 'store-01',
      role_id: 'role-manager',
      role: 'manager',
      name: 'Responsable Magasin',
      email: 'manager@test.com',
      pin_hash: 'mock-pin-hash',
      is_active: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    expect(authService.hasPermission('pos.checkout', manager)).toBe(true);
    expect(authService.hasPermission('sales.refund', manager)).toBe(true);
    expect(authService.hasPermission('inventory.adjust', manager)).toBe(true);
    expect(authService.hasPermission('purchases.manage', manager)).toBe(true);

    // Manager still cannot change system users or store settings
    expect(authService.hasPermission('users.manage', manager)).toBe(false);
    expect(authService.hasPermission('products.view_cost', manager)).toBe(false);
  });

  it('rejects trivial demo PINs (1234, 5678, 1111) for security compliance', () => {
    expect(SecurityUtil.validateNewPin('1234').valid).toBe(false);
    expect(SecurityUtil.validateNewPin('5678').valid).toBe(false);
    expect(SecurityUtil.validateNewPin('1111').valid).toBe(false);
    expect(SecurityUtil.validateNewPin('0000').valid).toBe(false);

    // Secure PIN accepted
    expect(SecurityUtil.validateNewPin('7492').valid).toBe(true);
  });

  it('validates manager salted hashed PIN for privileged overrides', async () => {
    const now = new Date().toISOString();
    const managerPin = '8392';
    const cashierPin = '3829';

    const managerPinHash = await SecurityUtil.hashCredential(managerPin);
    const cashierPinHash = await SecurityUtil.hashCredential(cashierPin);

    // Insert test manager and cashier with salted SHA-256 hashes
    await db.execute(
      `INSERT INTO users (id, store_id, role_id, role, name, email, pin_hash, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ['u-mgr-test', 'store-01', 'role-manager', 'manager', 'Manager Test', 'mgr@test.dz', managerPinHash, 1, now, now]
    );

    await db.execute(
      `INSERT INTO users (id, store_id, role_id, role, name, email, pin_hash, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ['u-csh-test', 'store-01', 'role-cashier', 'cashier', 'Cashier Test', 'csh@test.dz', cashierPinHash, 1, now, now]
    );

    // Valid manager PIN matches
    const validManager = await authService.verifyManagerPin(managerPin);
    expect(validManager).not.toBeNull();
    expect(validManager?.id).toBe('u-mgr-test');
    expect(validManager?.role).toBe('manager');

    // Invalid PIN fails
    const invalid = await authService.verifyManagerPin('9999');
    expect(invalid).toBeNull();

    // Cashier PIN cannot authorize manager override
    const cashierPinAttempt = await authService.verifyManagerPin(cashierPin);
    expect(cashierPinAttempt).toBeNull();
  });
});
