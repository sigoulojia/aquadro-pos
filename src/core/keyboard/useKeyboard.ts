import { useEffect, useRef } from 'react';
import { ShortcutRegistry, ShortcutOptions, KeyCombo } from './ShortcutRegistry';
import { ScannerInputManager } from './ScannerInputManager';

export function useShortcut(
  combo: KeyCombo, 
  handler: (e: KeyboardEvent) => void, 
  options?: ShortcutOptions
) {
  useEffect(() => {
    const registry = ShortcutRegistry.getInstance();
    const unregister = registry.register(combo, handler, options);
    
    return () => {
      unregister();
    };
  }, [combo, handler, options]);
}

export function useKeyboardScope(scopeName: string, isActive: boolean = true) {
  useEffect(() => {
    const registry = ShortcutRegistry.getInstance();
    
    if (isActive) {
      registry.pushScope(scopeName);
    } else {
      registry.popScope(scopeName);
    }
    
    return () => {
      registry.popScope(scopeName);
    };
  }, [scopeName, isActive]);
}

export function useScanner(onScan: (barcode: string) => void, isActive: boolean = true) {
  const onScanRef = useRef(onScan);
  useEffect(() => {
    onScanRef.current = onScan;
  });

  useEffect(() => {
    if (!isActive) return;
    
    const scannerManager = ScannerInputManager.getInstance();
    const unsubscribe = scannerManager.subscribe((barcode) => {
      onScanRef.current?.(barcode);
    });
    
    return () => {
      unsubscribe();
    };
  }, [isActive]);
}
