import { useEffect } from 'react';
import { scannerService, BarcodeScanCallback } from '../services/scanner.service';

export function useBarcodeScanner(onScan: BarcodeScanCallback) {
  useEffect(() => {
    const unsubscribe = scannerService.subscribe(onScan);
    return () => {
      unsubscribe();
    };
  }, [onScan]);
}
