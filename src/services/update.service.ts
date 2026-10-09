// Aquadro POS — Production Auto-Update Service
// Compatible with Tauri v2 plugin-updater with offline resilience and safe UI state management

import { check, Update, DownloadEvent } from '@tauri-apps/plugin-updater';

export type UpdateStatus = 
  | 'idle' 
  | 'checking' 
  | 'available' 
  | 'downloading' 
  | 'downloaded' 
  | 'up-to-date' 
  | 'error';

export interface UpdateInfo {
  version: string;
  currentVersion: string;
  date?: string;
  body?: string;
}

export interface DownloadProgress {
  downloadedBytes: number;
  totalBytes: number;
  percent: number;
}

export interface UpdateState {
  status: UpdateStatus;
  updateInfo: UpdateInfo | null;
  progress: DownloadProgress;
  error: string | null;
  lastChecked: string | null;
}

type UpdateListener = (state: UpdateState) => void;

export class UpdateService {
  private static instance: UpdateService;
  private pendingUpdate: Update | null = null;
  private listeners: Set<UpdateListener> = new Set();
  private lastCheckTimestamp = 0;
  private readonly CHECK_THROTTLE_MS = 15 * 60 * 1000; // 15 minutes throttle for silent checks

  private state: UpdateState = {
    status: 'idle',
    updateInfo: null,
    progress: {
      downloadedBytes: 0,
      totalBytes: 0,
      percent: 0,
    },
    error: null,
    lastChecked: null,
  };

  private constructor() {}

  public static getInstance(): UpdateService {
    if (!UpdateService.instance) {
      UpdateService.instance = new UpdateService();
    }
    return UpdateService.instance;
  }

  public isTauriEnvironment(): boolean {
    return typeof window !== 'undefined' && typeof (window as any).__TAURI_INTERNALS__?.invoke === 'function';
  }

  public getState(): UpdateState {
    return { ...this.state };
  }

  public subscribe(listener: UpdateListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    const currentState = this.getState();
    this.listeners.forEach((fn) => {
      try {
        fn(currentState);
      } catch (err) {
        console.error('[UpdateService] Listener error:', err);
      }
    });
  }

  private sanitizeErrorMessage(err: unknown): string {
    if (!err) return 'Unknown update error';
    const raw = err instanceof Error ? err.message : String(err);
    // Sanitize any accidental urls with tokens or sensitive details
    return raw.replace(/token=[a-zA-Z0-9_\-]+/gi, 'token=***')
              .replace(/key=[a-zA-Z0-9_\-]+/gi, 'key=***');
  }

  /**
   * Check for updates.
   * @param silent If true, throttles background calls and does not show error or up-to-date popups.
   */
  public async checkForUpdates(silent = false): Promise<UpdateInfo | null> {
    if (this.state.status === 'downloading') {
      return this.state.updateInfo;
    }

    const now = Date.now();
    if (silent && (now - this.lastCheckTimestamp) < this.CHECK_THROTTLE_MS && this.state.updateInfo) {
      return this.state.updateInfo;
    }

    if (!this.isTauriEnvironment()) {
      if (!silent) {
        console.info('[UpdateService] Web/Testing environment: updater disabled.');
        this.state = {
          ...this.state,
          status: 'up-to-date',
          error: null,
          lastChecked: new Date().toISOString(),
        };
        this.notify();
      }
      return null;
    }

    this.lastCheckTimestamp = now;
    this.state = {
      ...this.state,
      status: 'checking',
      error: null,
    };
    this.notify();

    try {
      const update = await check({
        timeout: 10000, // 10s network timeout
      });

      if (update && update.available) {
        this.pendingUpdate = update;
        const info: UpdateInfo = {
          version: update.version,
          currentVersion: update.currentVersion,
          date: update.date,
          body: update.body,
        };

        this.state = {
          ...this.state,
          status: 'available',
          updateInfo: info,
          error: null,
          lastChecked: new Date().toISOString(),
        };
        this.notify();
        return info;
      } else {
        if (this.pendingUpdate) {
          try {
            await this.pendingUpdate.close();
          } catch {}
          this.pendingUpdate = null;
        }

        this.state = {
          ...this.state,
          status: silent ? 'idle' : 'up-to-date',
          updateInfo: null,
          error: null,
          lastChecked: new Date().toISOString(),
        };
        this.notify();
        return null;
      }
    } catch (err: unknown) {
      const sanitized = this.sanitizeErrorMessage(err);
      console.warn('[UpdateService] Failed to check for updates:', sanitized);

      // Do NOT interrupt cashier or POS startup on network drops
      this.state = {
        ...this.state,
        status: silent ? 'idle' : 'error',
        error: silent ? null : sanitized,
        lastChecked: new Date().toISOString(),
      };
      this.notify();
      return null;
    }
  }

  /**
   * Download and install the available update.
   */
  public async downloadAndInstall(): Promise<void> {
    if (!this.pendingUpdate) {
      throw new Error('No update available to install');
    }

    if (!this.isTauriEnvironment()) {
      throw new Error('Updater is only supported in native desktop mode');
    }

    this.state = {
      ...this.state,
      status: 'downloading',
      error: null,
      progress: {
        downloadedBytes: 0,
        totalBytes: 0,
        percent: 0,
      },
    };
    this.notify();

    let totalBytes = 0;
    let downloadedBytes = 0;

    try {
      await this.pendingUpdate.downloadAndInstall((event: DownloadEvent) => {
        if (event.event === 'Started') {
          totalBytes = event.data.contentLength ?? 0;
          this.state.progress = {
            downloadedBytes: 0,
            totalBytes,
            percent: 0,
          };
          this.notify();
        } else if (event.event === 'Progress') {
          downloadedBytes += event.data.chunkLength;
          const percent = totalBytes > 0 ? Math.min(100, Math.round((downloadedBytes / totalBytes) * 100)) : 0;
          this.state.progress = {
            downloadedBytes,
            totalBytes,
            percent,
          };
          this.notify();
        } else if (event.event === 'Finished') {
          this.state.status = 'downloaded';
          this.state.progress.percent = 100;
          this.notify();
        }
      }, {
        timeout: 60000,
        restartAfterInstall: true,
      });
    } catch (err: unknown) {
      const sanitized = this.sanitizeErrorMessage(err);
      console.error('[UpdateService] Download/Install failed:', sanitized);
      this.state = {
        ...this.state,
        status: 'error',
        error: `Échec du téléchargement: ${sanitized}`,
      };
      this.notify();
      throw new Error(sanitized);
    }
  }

  /**
   * Dismiss the update notification.
   */
  public async dismiss(): Promise<void> {
    if (this.pendingUpdate) {
      try {
        await this.pendingUpdate.close();
      } catch {}
      this.pendingUpdate = null;
    }
    this.state = {
      ...this.state,
      status: 'idle',
      error: null,
    };
    this.notify();
  }
}

export const updateService = UpdateService.getInstance();
