/**
 * ShortcutRegistry
 * Manages global and scoped keyboard shortcuts.
 */

export type KeyCombo = string; // e.g. "F2", "Ctrl+S", "Shift+ArrowUp"

export interface ShortcutOptions {
  scope?: string; // 'global', 'pos', 'modal', etc. Defaults to 'global'
  preventDefault?: boolean;
  stopPropagation?: boolean;
  description?: string;
}

type ShortcutHandler = (e: KeyboardEvent) => void;

interface RegisteredShortcut {
  combo: KeyCombo;
  handler: ShortcutHandler;
  options: ShortcutOptions;
}

export class ShortcutRegistry {
  private static instance: ShortcutRegistry;
  private shortcuts: Map<string, Set<RegisteredShortcut>> = new Map();
  private activeScopes: string[] = ['global']; // 'global' is always active

  private constructor() {
    this.handleKeyDown = this.handleKeyDown.bind(this);
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', this.handleKeyDown);
    }
  }

  public static getInstance(): ShortcutRegistry {
    if (!ShortcutRegistry.instance) {
      ShortcutRegistry.instance = new ShortcutRegistry();
    }
    return ShortcutRegistry.instance;
  }

  /**
   * Pushes a new scope (e.g., when a modal opens)
   */
  public pushScope(scope: string) {
    if (!this.activeScopes.includes(scope)) {
      this.activeScopes.push(scope);
    }
  }

  /**
   * Removes a scope (e.g., when a modal closes)
   */
  public popScope(scope: string) {
    this.activeScopes = this.activeScopes.filter(s => s !== scope);
  }

  public register(combo: KeyCombo, handler: ShortcutHandler, options: ShortcutOptions = {}): () => void {
    const scope = options.scope || 'global';
    
    if (!this.shortcuts.has(scope)) {
      this.shortcuts.set(scope, new Set());
    }
    
    const shortcut: RegisteredShortcut = { combo, handler, options };
    this.shortcuts.get(scope)!.add(shortcut);

    return () => {
      this.shortcuts.get(scope)?.delete(shortcut);
    };
  }

  private handleKeyDown(e: KeyboardEvent) {
    // Determine the combo string from the event
    const keys = [];
    if (e.ctrlKey) keys.push('Ctrl');
    if (e.shiftKey) keys.push('Shift');
    if (e.altKey) keys.push('Alt');
    if (e.metaKey) keys.push('Meta');
    
    let key = e.key;
    if (key === ' ') key = 'Space';
    if (key.length === 1 && key !== 'Space') key = key.toUpperCase(); // Normalize 'a' to 'A'
    
    if (!['Control', 'Shift', 'Alt', 'Meta'].includes(key)) {
      keys.push(key);
    }
    
    const comboString = keys.join('+');

    // We check scopes from most recent to oldest (LIFO) so modals intercept before background
    const scopesToCheck = [...this.activeScopes].reverse();
    
    for (const scope of scopesToCheck) {
      const scopeShortcuts = this.shortcuts.get(scope);
      if (scopeShortcuts) {
        let handled = false;
        for (const shortcut of scopeShortcuts) {
          if (shortcut.combo.toUpperCase() === comboString.toUpperCase()) {
            if (shortcut.options.preventDefault !== false) e.preventDefault();
            if (shortcut.options.stopPropagation !== false) e.stopPropagation();
            shortcut.handler(e);
            handled = true;
          }
        }
        if (handled) return; // Stop propagating to lower scopes if handled in a higher scope
      }
    }
  }

  public getActiveShortcuts() {
    return this.shortcuts;
  }
}
