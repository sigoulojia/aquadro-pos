// Aquadro POS Algérie V2 — Barre Latérale Navigation ERP (Sidebar)
// Style sobre : Fond blanc cassé, bordures fines, icônes simples, sans boutons géants

import React from 'react';
import {
  ShoppingCart,
  LayoutDashboard,
  Package,
  Layers,
  Truck,
  Receipt,
  History,
  CreditCard,
  Users,
  Building2,
  Vault,
  Wallet,
  BarChart3,
  FileText,
  UserCog,
  Settings
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useI18n } from '../../i18n';

export type NavView =
  | 'pos'
  | 'dashboard'
  | 'products'
  | 'inventory'
  | 'purchases'
  | 'sales'
  | 'customers'
  | 'suppliers'
  | 'caisse'
  | 'credits'
  | 'expenses'
  | 'reports'
  | 'documents'
  | 'journal'
  | 'users'
  | 'settings';

interface SidebarProps {
  currentView: NavView;
  onNavigate: (view: NavView) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentView, onNavigate }) => {
  const { hasPermission } = useAuth();
  const { t } = useI18n();

  const navItems: Array<{
    id: NavView;
    label: string;
    icon: React.ReactNode;
    permission?: string;
    shortcut?: string;
  }> = [
    { id: 'pos', label: t('nav.pos'), icon: <ShoppingCart className="w-4 h-4" />, shortcut: 'F1' },
    { id: 'dashboard', label: t('nav.dashboard'), icon: <LayoutDashboard className="w-4 h-4" />, shortcut: 'F2' },
    { id: 'products', label: t('nav.products'), icon: <Package className="w-4 h-4" />, shortcut: 'F3' },
    { id: 'inventory', label: t('nav.inventory'), icon: <Layers className="w-4 h-4" />, shortcut: 'F4' },
    { id: 'purchases', label: t('nav.purchases'), icon: <Truck className="w-4 h-4" />, permission: 'purchases.manage', shortcut: 'F5' },
    { id: 'sales', label: t('nav.sales'), icon: <Receipt className="w-4 h-4" />, shortcut: 'F6' },
    { id: 'customers', label: t('nav.customers'), icon: <Users className="w-4 h-4" />, shortcut: 'F7' },
    { id: 'credits', label: 'Gestion des Crédits', icon: <CreditCard className="w-4 h-4" />, shortcut: 'F8' },
    { id: 'suppliers', label: t('nav.suppliers'), icon: <Building2 className="w-4 h-4" />, shortcut: 'F9' },
    { id: 'caisse', label: t('nav.caisse'), icon: <Vault className="w-4 h-4" />, shortcut: 'F10' },
    { id: 'expenses', label: t('nav.expenses'), icon: <Wallet className="w-4 h-4" />, shortcut: 'F11' },
    { id: 'journal', label: 'Journal d\'Activité', icon: <History className="w-4 h-4" />, shortcut: 'F12' },
    { id: 'reports', label: t('nav.reports'), icon: <BarChart3 className="w-4 h-4" />, permission: 'reports.view' },
    { id: 'documents', label: t('nav.documents'), icon: <FileText className="w-4 h-4" /> },
    { id: 'users', label: t('nav.users'), icon: <UserCog className="w-4 h-4" />, permission: 'users.manage' },
    { id: 'settings', label: t('nav.settings'), icon: <Settings className="w-4 h-4" /> }
  ];

  return (
    <aside className="w-48 bg-white border-r border-gray-200 flex flex-col justify-between py-2 px-1.5 select-none z-20 shrink-0 text-gray-700 text-xs">
      <div className="space-y-0.5">
        {navItems.map(item => {
          if (item.permission && !hasPermission(item.permission)) {
            return null;
          }

          const isActive = currentView === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`w-full flex items-center justify-between px-2.5 py-2 rounded text-left transition-colors font-medium ${
                isActive
                  ? 'bg-blue-50 text-blue-700 font-semibold border-l-2 border-blue-600'
                  : 'hover:bg-gray-50 text-gray-700'
              }`}
            >
              <div className="flex items-center space-x-2.5">
                <span className={isActive ? 'text-blue-600' : 'text-gray-500'}>{item.icon}</span>
                <span className="truncate">{item.label}</span>
              </div>
              {item.shortcut && (
                <span className="text-[10px] font-mono px-1 py-0.2 rounded bg-gray-100 text-gray-500 border border-gray-200">
                  {item.shortcut}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Pied de barre latérale sobre */}
      <div className="pt-2 border-t border-gray-100 px-2 text-[10px] text-gray-400 flex items-center justify-between font-mono">
        <span>v2.0 DZ</span>
        <span className="text-emerald-600 font-bold">SQLITE OK</span>
      </div>
    </aside>
  );
};
