// Aquadro POS Algérie V2 — Service d'Authentification & Rôles Employés (RBAC)
// Integration avec Rust Session Manager (Security Fortress)

import { db } from '../db/sqlite';
import { User, UserRole } from '../types/database';
import { SecurityUtil } from '../core/security/security';
import { SecurityUtil as HashUtil } from '../utils/security';
import { invoke as tauriInvoke } from '@tauri-apps/api/core';

const isTauri = typeof window !== 'undefined' && typeof (window as any).__TAURI_INTERNALS__?.invoke === 'function';

async function invoke(cmd: string, args?: any): Promise<any> {
  if (isTauri) {
    return await tauriInvoke(cmd, args);
  }
  console.warn(`[Web Mode] Mocking Tauri invoke for: ${cmd}`);
  switch (cmd) {
    case 'authenticate_user': {
      const allUsers = await db.select<User>('SELECT * FROM users WHERE is_active = 1');
      if (allUsers.length === 0) {
        // Auto-create dev owner if db is empty (e.g. SetupWizard was bypassed or failed earlier)
        await db.execute(
          `INSERT INTO users (id, name, role, pin_hash, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?)`,
          [`usr-dev-owner`, 'Web Admin (Dev)', 'owner', args.pin, new Date().toISOString(), new Date().toISOString()]
        );
        const devUser = (await db.select<User>('SELECT * FROM users WHERE id = ?', ['usr-dev-owner']))[0];
        return { token: `dev-token-${devUser.id}`, user: devUser };
      }
      for (const u of allUsers) {
        if (u.pin_hash === args.pin) {
          return { token: `dev-token-${u.id}`, user: u };
        }
        if (u.pin_hash && u.pin_hash.includes(':')) {
          const match = await HashUtil.verifyCredential(args.pin, u.pin_hash);
          if (match) {
            return { token: `dev-token-${u.id}`, user: u };
          }
        }
      }
      throw new Error("Code PIN incorrect");
    }
    case 'verify_session': {
      const id = args.token.replace('dev-token-', '');
      const users = await db.select<User>('SELECT * FROM users WHERE id = ? AND is_active = 1', [id]);
      if (users.length > 0) return users[0];
      throw new Error("Session expirée");
    }
    case 'logout_user':
      return true;
    case 'hash_new_pin':
      return `mock-hash-${args?.pin}`;
    default:
      return {};
  }
}

export class AuthService {
  private static instance: AuthService;
  private currentUser: User | null = null;
  private sessionToken: string | null = null;
  private listeners: Array<(user: User | null) => void> = [];
  private idleTimeout: NodeJS.Timeout | null = null;
  private readonly IDLE_LIMIT = 5 * 60 * 1000; // 5 minutes

  private constructor() {
    this.setupIdleWatcher();
  }

  private setupIdleWatcher() {
    if (typeof window === 'undefined') return;
    window.addEventListener('mousemove', this.resetIdleTimeout);
    window.addEventListener('keydown', this.resetIdleTimeout);
    window.addEventListener('click', this.resetIdleTimeout);
  }

  private resetIdleTimeout = () => {
    if (this.idleTimeout) clearTimeout(this.idleTimeout);
    if (this.currentUser) {
      this.idleTimeout = setTimeout(() => {
        console.log("Déconnexion automatique pour inactivité (5 minutes)");
        this.logout();
      }, this.IDLE_LIMIT);
    }
  };

  public static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  public getSessionToken(): string | null {
    return this.sessionToken;
  }

  public async initSession(): Promise<User | null> {
    const savedToken = localStorage.getItem('aquadro_session_token');
    if (savedToken) {
      try {
        const user: User = await invoke('verify_session', { token: savedToken });
        this.sessionToken = savedToken;
        this.currentUser = user;
        this.notify();
        return user;
      } catch (e) {
        console.warn("Session expirée ou invalide:", e);
        this.logout();
      }
    }
    this.currentUser = null;
    this.sessionToken = null;
    this.notify();
    return null;
  }

  public getCurrentUser(): User | null {
    return this.currentUser;
  }

  public async logout(): Promise<void> {
    if (this.sessionToken) {
      try {
        await invoke('logout_user', { token: this.sessionToken });
      } catch (e) {
        console.error("Erreur déconnexion backend", e);
      }
    }
    this.currentUser = null;
    this.sessionToken = null;
    localStorage.removeItem('aquadro_session_token');
    this.notify();
  }

  public subscribe(listener: (user: User | null) => void): () => void {
    this.listeners.push(listener);
    listener(this.currentUser);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notify(): void {
    this.resetIdleTimeout();
    for (const listener of this.listeners) {
      listener(this.currentUser);
    }
  }

  public async getAllUsers(): Promise<User[]> {
    if (!this.sessionToken) throw new Error("Non authentifié");
    return await invoke('get_users', { token: this.sessionToken });
  }

  public async loginWithPin(pin: string): Promise<User | null> {
    try {
      const response: { token: string; user: User } = await invoke('authenticate_user', { pin });
      this.sessionToken = response.token;
      this.currentUser = response.user;
      localStorage.setItem('aquadro_session_token', response.token);
      this.notify();
      return response.user;
    } catch (error: any) {
      // Propagation de l'erreur (ex: Rate limit ou PIN invalide) pour l'UI
      throw new Error(error);
    }
  }

  // Vérifier si un PIN saisi appartient à un Manager ou Owner (utile pour les overrides d'UI)
  public async verifyManagerOrOwnerPin(inputPin: string): Promise<{ valid: boolean; user?: User }> {
    try {
      const response: { token: string; user: User } = await invoke('authenticate_user', { pin: inputPin });
      if (['owner', 'manager'].includes(response.user.role)) {
        // Déconnecter immédiatement ce token car on vérifie juste, on ne veut pas écraser la session courante
        await invoke('logout_user', { token: response.token });
        return { valid: true, user: response.user };
      }
      return { valid: false };
    } catch (e) {
      return { valid: false };
    }
  }

  public async verifyManagerPin(inputPin: string): Promise<User | null> {
    const res = await this.verifyManagerOrOwnerPin(inputPin);
    return res.valid && res.user ? res.user : null;
  }

  // Créer un utilisateur avec code PIN sécurisé (Le hachage se fait en Rust)
  public async createUser(data: {
    name: string;
    role: UserRole;
    pin: string;
    phone?: string;
  }): Promise<User> {
    const validation = SecurityUtil.validateNewPin(data.pin);
    if (!validation.valid) {
      throw new Error(validation.error);
    }
    if (!this.sessionToken) throw new Error("Non authentifié");

    return await invoke('create_user', {
      name: data.name.trim(),
      role: data.role,
      pin: data.pin,
      phone: data.phone?.trim() || null,
      token: this.sessionToken
    });
  }

  // Changer le code PIN d'un utilisateur existant
  public async updateUserPin(userId: string, newPin: string): Promise<void> {
    const validation = SecurityUtil.validateNewPin(newPin);
    if (!validation.valid) {
      throw new Error(validation.error);
    }
    if (!this.sessionToken) throw new Error("Non authentifié");
    
    await invoke('update_user_pin', { id: userId, pin: newPin, token: this.sessionToken });
  }

  // Désactiver (soft-delete) un utilisateur
  public async deactivateUser(userId: string): Promise<void> {
    if (!this.sessionToken) throw new Error("Non authentifié");
    await invoke('deactivate_user', { id: userId, token: this.sessionToken });
  }

  // Permission RBAC de base pour le frontend (Le Backend valide toujours de façon authoritaire)
  public hasPermission(permission: string, user: User | null = this.currentUser): boolean {
    if (!user) return false;
    if (user.role === 'owner') return true;
    if (user.role === 'manager') {
      return !['users.manage', 'fiscal.settings', 'backup.restore', 'products.view_cost'].includes(permission);
    }
    // Caissier : POS, vente, consultation des ventes et clients
    return ['pos.checkout', 'pos.search', 'sales.view', 'customers.view'].includes(permission);
  }
}

export const authService = AuthService.getInstance();
