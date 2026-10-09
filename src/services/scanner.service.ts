export type BarcodeScanCallback = (barcode: string) => void;

export class BarcodeScannerService {
  private static instance: BarcodeScannerService;
  private buffer: string = '';
  private lastKeyTime: number = 0;
  private maxInterKeyDelay: number = 45; // ms threshold between barcode scanner keystrokes
  private listeners: BarcodeScanCallback[] = [];
  private isListening: boolean = false;

  private constructor() {
    this.handleKeyDown = this.handleKeyDown.bind(this);
  }

  public static getInstance(): BarcodeScannerService {
    if (!BarcodeScannerService.instance) {
      BarcodeScannerService.instance = new BarcodeScannerService();
    }
    return BarcodeScannerService.instance;
  }

  public startListening() {
    if (this.isListening || typeof window === 'undefined') return;
    window.addEventListener('keydown', this.handleKeyDown, true);
    this.isListening = true;
  }

  public stopListening() {
    if (!this.isListening || typeof window === 'undefined') return;
    window.removeEventListener('keydown', this.handleKeyDown, true);
    this.isListening = false;
  }

  public subscribe(callback: BarcodeScanCallback): () => void {
    this.listeners.push(callback);
    this.startListening();
    return () => {
      this.listeners = this.listeners.filter(cb => cb !== callback);
      if (this.listeners.length === 0) {
        this.stopListening();
      }
    };
  }

  private handleKeyDown(e: KeyboardEvent) {
    const target = e.target as HTMLElement;
    // If the user is actively typing in a standard input, let manual typing through unless it is high-speed scan
    const isInputFocused = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA');

    const currentTime = Date.now();
    const timeDelta = currentTime - this.lastKeyTime;
    this.lastKeyTime = currentTime;

    // Enter signals end of barcode scan
    if (e.key === 'Enter') {
      if (this.buffer.length >= 4) {
        const scannedCode = this.buffer.trim();
        this.buffer = '';
        e.preventDefault();
        e.stopPropagation();
        this.notify(scannedCode);
      } else {
        this.buffer = '';
      }
      return;
    }

    // Ignore non-printable keys (Shift, Ctrl, Alt, etc.)
    if (e.key.length > 1) {
      return;
    }

    // Check if keystroke timing matches high-speed scanner
    if (this.buffer.length === 0 || timeDelta <= this.maxInterKeyDelay) {
      this.buffer += e.key;
    } else {
      // Too slow, probably manual human typing - reset buffer to this key
      this.buffer = e.key;
    }
  }

  public simulateScan(barcode: string) {
    this.notify(barcode.trim());
  }

  private notify(barcode: string) {
    for (const callback of this.listeners) {
      try {
        callback(barcode);
      } catch (err) {
        console.error('Barcode listener error:', err);
      }
    }
  }
}

export const scannerService = BarcodeScannerService.getInstance();
