import { useState, useEffect } from 'react';
import { SyncStatusState } from '../types/sync';
import { syncService } from '../services/sync.service';

export function useSync() {
  const [syncState, setSyncState] = useState<SyncStatusState>(syncService.getStatus());

  useEffect(() => {
    return syncService.subscribe(setSyncState);
  }, []);

  return {
    ...syncState,
    triggerSync: () => syncService.triggerSync()
  };
}
