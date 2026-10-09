// Aquadro POS — Production-Grade Frontend Logger Bridge
// Transmet les événements, erreurs de caisse, scanner, impression et exceptions non gérées
// au journal rotatif natif Rust (AppData/logs/aquadro_YYYY-MM-DD.log).

export type LogLevel = 'INFO' | 'WARN' | 'ERROR';

export class LoggerService {
  private static instance: LoggerService;
  private isTauri = false;

  private constructor() {
    this.isTauri = typeof window !== 'undefined' && typeof (window as any).__TAURI_INTERNALS__?.invoke === 'function';
    this.setupGlobalHandlers();
  }

  public static getInstance(): LoggerService {
    if (!LoggerService.instance) {
      LoggerService.instance = new LoggerService();
    }
    return LoggerService.instance;
  }

  private setupGlobalHandlers(): void {
    if (typeof window === 'undefined') return;

    // Interception des erreurs JavaScript globales non capturées
    window.addEventListener('error', (event: ErrorEvent) => {
      this.error(
        'FRONTEND_UNCAUGHT',
        event.message || 'Erreur script non capturée',
        `File: ${event.filename}:${event.lineno}:${event.colno}`
      );
    });

    // Interception des promesses rejetées non gérées
    window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
      const reason = event.reason instanceof Error ? event.reason.stack || event.reason.message : String(event.reason);
      this.error(
        'FRONTEND_UNHANDLED_PROMISE',
        'Promesse asynchrone rejetée sans capture',
        reason
      );
    });
  }

  public async log(level: LogLevel, category: string, message: string, details?: string): Promise<void> {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level}] [${category}]`;

    if (level === 'ERROR') {
      console.error(prefix, message, details || '');
    } else if (level === 'WARN') {
      console.warn(prefix, message, details || '');
    } else {
      console.log(prefix, message, details || '');
    }

    if (this.isTauri) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('log_event', {
          level,
          category,
          message,
          details: details || null,
        });
      } catch (err) {
        // Ne jamais faire planter l'application en cas d'erreur de journalisation
        console.warn('[LoggerService] Échec de transmission au logger natif:', err);
      }
    }
  }

  public info(category: string, message: string, details?: string): void {
    this.log('INFO', category, message, details);
  }

  public warn(category: string, message: string, details?: string): void {
    this.log('WARN', category, message, details);
  }

  public error(category: string, message: string, details?: string): void {
    this.log('ERROR', category, message, details);
  }

  // Helpers pour les sous-systèmes critiques POS
  public logScannerError(message: string, details?: string): void {
    this.error('SCANNER', message, details);
  }

  public logCheckoutError(message: string, details?: string): void {
    this.error('CHECKOUT', message, details);
  }

  public logPaymentError(message: string, details?: string): void {
    this.error('PAYMENT', message, details);
  }

  public logPrintError(message: string, details?: string): void {
    this.error('PRINTER', message, details);
  }

  public logRefundError(message: string, details?: string): void {
    this.error('REFUND', message, details);
  }
}

export const logger = LoggerService.getInstance();
