export type SyncConnectionState = 'ONLINE' | 'OFFLINE' | 'SYNCING' | 'ERROR';

export interface SyncStatusState {
  connectionState: SyncConnectionState;
  pendingCount: number;
  lastSyncedAt: string | null;
  lastError: string | null;
  isAutoSyncEnabled: boolean;
}
