// Aquadro POS Algérie V2 — Backend API Bridge
// This module defines the strict API boundary established in PHASE 1.
// All database access and domain logic should be routed through these Tauri commands.

import { invoke as tauriInvoke } from '@tauri-apps/api/core';

const isTauri = typeof window !== 'undefined' && typeof (window as any).__TAURI_INTERNALS__?.invoke === 'function';

async function invoke(cmd: string, args?: any): Promise<any> {
  if (isTauri) {
    return await tauriInvoke(cmd, args);
  }
  console.warn(`[Web Mode] Mocking Tauri invoke for: ${cmd}`);
  if (cmd === 'process_checkout') {
    return { id: `sale-${Date.now()}`, ...args.payload };
  }
  return {};
}
import { Sale } from '../types/database';
import { ProcessCheckoutPayload } from '../services/checkout.service';

export class BackendAPI {
  /**
   * Processes a checkout atomically on the Rust backend.
   * Replaces the raw frontend SQL executions with a secure Tauri command.
   */
  public static async processCheckout(payload: ProcessCheckoutPayload): Promise<Sale> {
    try {
      const sale: Sale = await invoke('process_checkout', { payload });
      return sale;
    } catch (error) {
      console.error('Backend checkout failed:', error);
      throw error;
    }
  }

  // Future backend APIs for Phase 2-8 will be added here
  // public static async authenticate(pin: string): Promise<User>
  // public static async getZReport(sessionId: string): Promise<ZReport>
}
