import React from 'react';
import { useSync } from '../../hooks/useSync';
import { Wifi, WifiOff, RefreshCw, AlertCircle } from 'lucide-react';

export const SyncBadge: React.FC = () => {
  const { connectionState, pendingCount, lastSyncedAt, triggerSync } = useSync();

  const handleSyncClick = async () => {
    await triggerSync();
  };

  if (connectionState === 'SYNCING') {
    return (
      <button
        onClick={handleSyncClick}
        className="flex items-center space-x-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs font-medium animate-pulse"
        title="Synchronizing local database with Supabase cloud..."
      >
        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
        <span>Syncing ({pendingCount})</span>
      </button>
    );
  }

  if (connectionState === 'OFFLINE') {
    return (
      <div
        className="flex items-center space-x-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-medium cursor-help"
        title="Operating offline. All checkouts and stock movements buffered locally in SQLite."
      >
        <WifiOff className="w-3.5 h-3.5" />
        <span>Offline Mode ({pendingCount} Queued)</span>
      </div>
    );
  }

  if (connectionState === 'ERROR') {
    return (
      <button
        onClick={handleSyncClick}
        className="flex items-center space-x-2 px-3 py-1.5 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-medium hover:bg-rose-500/20"
        title="Sync encountered an error. Click to retry."
      >
        <AlertCircle className="w-3.5 h-3.5" />
        <span>Sync Error (Retry)</span>
      </button>
    );
  }

  return (
    <button
      onClick={handleSyncClick}
      className="flex items-center space-x-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-medium hover:bg-emerald-500/20 transition-colors"
      title={`Cloud Synchronized. Last synced: ${lastSyncedAt ? new Date(lastSyncedAt).toLocaleTimeString() : 'Just now'}`}
    >
      <Wifi className="w-3.5 h-3.5" />
      <span>Cloud Synced</span>
    </button>
  );
};
