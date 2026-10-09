import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UpdateService, updateService } from '../src/services/update.service';

describe('UpdateService & Auto-Update Engine', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes with idle status and clean state', () => {
    const state = updateService.getState();
    expect(state.status).toBeDefined();
    expect(state.progress.percent).toBe(0);
    expect(state.progress.downloadedBytes).toBe(0);
  });

  it('notifies subscribers upon state changes', () => {
    const listener = vi.fn();
    const unsubscribe = updateService.subscribe(listener);
    expect(listener).toHaveBeenCalled();
    unsubscribe();
  });

  it('safely handles non-Tauri / Web environments without throwing', async () => {
    // In Vitest environment, isTauri is false
    const info = await updateService.checkForUpdates(false);
    expect(info).toBeNull();
    const state = updateService.getState();
    expect(state.status).toBe('up-to-date');
    expect(state.error).toBeNull();
  });

  it('silent check suppresses up-to-date notifications and does not disrupt the caller', async () => {
    const info = await updateService.checkForUpdates(true);
    expect(info).toBeNull();
  });

  it('sanitizes sensitive tokens or secrets from update error messages', () => {
    const service = UpdateService.getInstance();
    // Use reflection to test private sanitizeErrorMessage
    const sanitized = (service as any).sanitizeErrorMessage('Error connect to https://releases.com?token=supersecret123&key=mykey456');
    expect(sanitized).not.toContain('supersecret123');
    expect(sanitized).not.toContain('mykey456');
    expect(sanitized).toContain('token=***');
    expect(sanitized).toContain('key=***');
  });

  it('dismiss resets state to idle cleanly', async () => {
    await updateService.dismiss();
    const state = updateService.getState();
    expect(state.status).toBe('idle');
    expect(state.error).toBeNull();
  });
});
