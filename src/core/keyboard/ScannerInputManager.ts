/**
 * ScannerInputManager
 * Differentiates rapid barcode scanner input from manual keyboard typing.
 */

type ScanCallback = (barcode: string) => void;

export class ScannerInputManager {
  private static instance: ScannerInputManager;
  
  private buffer: string = '';
  private lastKeyTime: number = 0;
  private scanCallbacks: Set<ScanCallback> = new Set();
  
  // Scanners usually input characters very quickly (< 20-40ms per char)
  // 65ms reliably distinguishes USB scanners from human typists (> 100-150ms)
  private readonly TIMEOUT_MS = 65; 
  private readonly MIN_LENGTH = 3; 
  private suppressEnterUntil: number = 0;

  private constructor() {
    this.handleKeyDown = this.handleKeyDown.bind(this);
    if (typeof window !== 'undefined') {
      // Use capture phase to intercept before component handlers if needed
      window.addEventListener('keydown', this.handleKeyDown, true);
    }
  }

  public static getInstance(): ScannerInputManager {
    if (!ScannerInputManager.instance) {
      ScannerInputManager.instance = new ScannerInputManager();
    }
    return ScannerInputManager.instance;
  }

  public getLastScanTime(): number {
    return this.suppressEnterUntil ? this.suppressEnterUntil - 120 : 0;
  }

  public subscribe(callback: ScanCallback): () => void {
    this.scanCallbacks.add(callback);
    return () => {
      this.scanCallbacks.delete(callback);
    };
  }

  public simulateScan(barcode: string): void {
    this.notifyCallbacks(barcode);
  }

  public handleTestKey(key: string, repeat: boolean = false, target?: any): void {
    this.handleKeyDown({
      key,
      repeat,
      ctrlKey: false,
      altKey: false,
      metaKey: false,
      target,
      preventDefault: () => {},
      stopPropagation: () => {},
    } as any);
  }

  private handleKeyDown(e: KeyboardEvent) {
    // If no active subscribers, do not intercept keyboard input
    if (this.scanCallbacks.size === 0) {
      this.buffer = '';
      return;
    }

    // Do not interfere with user typing in standard input fields (customer search,
    // payment modal inputs, quantity inputs, dialogs) unless the input is explicitly
    // designated as the dedicated barcode scanner receiver.
    const target = e.target as HTMLElement | null;
    const isStandardInput = target && (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.tagName === 'SELECT' ||
      target.isContentEditable
    );
    const isDedicatedScanner = target?.getAttribute?.('data-barcode-scanner') === 'true';

    if (isStandardInput && !isDedicatedScanner) {
      this.buffer = '';
      return;
    }

    // Key repeat (user holding down a key) is never a barcode scanner
    if (e.repeat) {
      this.buffer = '';
      return;
    }

    const now = Date.now();
    
    // If it's been too long since the last key, reset the buffer
    if (now - this.lastKeyTime > this.TIMEOUT_MS) {
      this.buffer = '';
    }

    this.lastKeyTime = now;

    // Handle Enter key (end of scan)
    if (e.key === 'Enter') {
      if (this.buffer.length >= this.MIN_LENGTH) {
        // It's a valid scanner transmission!
        e.preventDefault();
        e.stopPropagation();
        
        const barcode = this.buffer;
        this.buffer = '';
        this.suppressEnterUntil = now + 120; // 120ms suppression for trailing enters
        
        this.notifyCallbacks(barcode);
        return;
      }
      
      if (now < this.suppressEnterUntil) {
        e.preventDefault();
        e.stopPropagation();
        this.buffer = '';
        return;
      }

      this.buffer = '';
      return;
    }

    // Only collect printable characters without modifier keys
    if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
      this.buffer += e.key;
    }
  }

  private notifyCallbacks(barcode: string) {
    this.scanCallbacks.forEach(cb => {
      try {
        cb(barcode);
      } catch (err) {
        console.error('Error in barcode scan callback:', err);
      }
    });
  }
  
  public destroy() {
    if (typeof window !== 'undefined') {
      window.removeEventListener('keydown', this.handleKeyDown, true);
    }
    this.scanCallbacks.clear();
    this.buffer = '';
  }
}
