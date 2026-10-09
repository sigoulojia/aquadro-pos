// Aquadro POS Algérie V2 — Barre Supérieure Sobre & Professionnelle (Navbar)
// Design épuré : Fond blanc, bordures grises, informations de caisse, synchronisation et langue

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useI18n } from '../../i18n';
import { caisseService } from '../../services/caisse.service';
import { syncService } from '../../services/sync.service';
import { printerService } from '../../services/printer.service';
import { authService } from '../../services/auth.service';
import { User, CashSession } from '../../types/database';
import {
  Clock,
  Globe,
  Wifi,
  WifiOff,
  UserCheck,
  ChevronDown,
  Sparkles,
  KeyRound,
  CheckCircle,
  AlertCircle,
  LogOut
} from 'lucide-react';

interface NavbarProps {
  onToggleAI: () => void;
  isAIOpen: boolean;
  onNavigateToSettings: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onToggleAI, isAIOpen, onNavigateToSettings }) => {
  const { user } = useAuth();
  const { language, setLanguage, t } = useI18n();
  const [time, setTime] = useState<string>('');
  const [session, setSession] = useState<CashSession | null>(null);
  const [pendingSync, setPendingSync] = useState<number>(0);
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [showUserMenu, setShowUserMenu] = useState<boolean>(false);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [drawerPulseNotice, setDrawerPulseNotice] = useState<boolean>(false);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const refreshStatus = async () => {
      const active = await caisseService.getActiveSession();
      setSession(active);
      const pending = await syncService.getPendingCount();
      setPendingSync(pending);
      setIsOnline(navigator.onLine);
    };
    refreshStatus();
    const interval = setInterval(refreshStatus, 8000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    authService.getAllUsers().then(setAllUsers);
  }, []);

  const handleKickDrawer = async () => {
    await printerService.kickCashDrawer();
    setDrawerPulseNotice(true);
    setTimeout(() => setDrawerPulseNotice(false), 2000);
  };

  const handleLogout = async () => {
    if (session) {
      const printZ = window.confirm("Voulez-vous imprimer le ticket Z (Total de la journée) avant de vous déconnecter ?");
      if (printZ) {
        try {
          const closed = await caisseService.closeShift({
            sessionId: session.id,
            actualCountedCash: session.expected_cash_drawer,
            closingNotes: 'Auto-clôture à la déconnexion'
          });
          const zData = await caisseService.getZReportData(closed.id);
          // TODO: printerService.printZReport(zData);
          await printerService.printZReport(zData);
        } catch (e) {
          console.error("Erreur clôture Z", e);
        }
      }
    }
    authService.logout();
    setShowUserMenu(false);
  };

  return (
    <header className="h-12 bg-white border-b border-gray-200 px-4 flex items-center justify-between select-none z-30 text-gray-800 text-xs">
      {/* 1. Établissement & Nom du Magasin */}
      <div className="flex items-center space-x-3">
        <div className="flex items-center space-x-2">
          <div className="w-6 h-6 bg-slate-800 text-white font-black rounded flex items-center justify-center text-xs">
            A
          </div>
          <div>
            <span className="font-bold tracking-tight text-gray-900 text-sm">
              Aquadro POS
            </span>
          </div>
        </div>

        {/* État de la Session de Caisse Active */}
        <div className="hidden md:flex items-center space-x-1.5 px-2 py-0.5 rounded border text-[11px] font-medium bg-gray-50 border-gray-200">
          <span className={`w-2 h-2 rounded-full ${session ? 'bg-emerald-500' : 'bg-amber-500'}`} />
          <span className="text-gray-700">
            {session ? `${t('caisse.statusOpen')} (${session.cashier_name})` : t('caisse.statusClosed')}
          </span>
        </div>
      </div>

      {/* 2. Actions Matérielles & Synchronisation */}
      <div className="flex items-center space-x-2">
        {/* Impulsion Tiroir-Caisse RJ11 */}
        <button
          onClick={handleKickDrawer}
          className={`flex items-center space-x-1 px-2.5 py-1 rounded border text-xs font-medium transition-colors ${
            drawerPulseNotice
              ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
              : 'bg-white hover:bg-gray-50 border-gray-300 text-gray-700'
          }`}
          title="Envoyer impulsion électrique 24V au tiroir-caisse RJ11"
        >
          <KeyRound className="w-3.5 h-3.5 text-gray-500" />
          <span>{drawerPulseNotice ? 'Tiroir Ouvert' : 'Tiroir'}</span>
        </button>

        {/* Statut Réseau & Synchronisation Outbox */}
        <button 
          onClick={onNavigateToSettings}
          className="flex items-center space-x-1.5 px-2 py-1 rounded border border-gray-200 bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer text-[11px] text-gray-600"
          title="Aller à la file d'attente de synchronisation"
        >
          {isOnline ? (
            <Wifi className="w-3.5 h-3.5 text-emerald-600" />
          ) : (
            <WifiOff className="w-3.5 h-3.5 text-amber-600" />
          )}
          <span>{isOnline ? t('app.online') : t('app.offline')}</span>
          {pendingSync > 0 ? (
            <span className="flex items-center space-x-1 text-amber-700 font-semibold bg-amber-100 px-1.5 py-0.5 rounded ml-1">
              <AlertCircle className="w-3 h-3" />
              <span>{pendingSync} outbox</span>
            </span>
          ) : (
            <span className="flex items-center space-x-1 text-emerald-700 font-semibold bg-emerald-100 px-1.5 py-0.5 rounded ml-1">
              <CheckCircle className="w-3 h-3" />
              <span>Sync</span>
            </span>
          )}
        </button>

        {/* Horloge Locale */}
        <div className="hidden sm:flex items-center space-x-1 px-2 py-1 rounded border border-gray-200 bg-gray-50 text-gray-600 font-mono text-[11px]">
          <Clock className="w-3.5 h-3.5 text-gray-400" />
          <span>{time}</span>
        </div>
      </div>

      {/* 3. Copilote & Profil Caissier */}
      <div className="flex items-center space-x-2">

        {/* Bouton Assistant IA (Sobre) */}
        <button
          onClick={onToggleAI}
          className={`flex items-center space-x-1 px-2.5 py-1 rounded border text-xs font-medium transition-colors ${
            isAIOpen
              ? 'bg-blue-600 text-white border-blue-600'
              : 'bg-white hover:bg-gray-50 text-gray-700 border-gray-300'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>{t('app.retailCopilot')}</span>
        </button>

        {/* Menu Utilisateur / Changement de Caissier */}
        <div className="relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center space-x-1.5 px-2.5 py-1 rounded border border-gray-300 bg-white hover:bg-gray-50 transition-colors"
          >
            <UserCheck className="w-3.5 h-3.5 text-gray-500" />
            <span className="font-semibold text-gray-900">{user?.name || 'Caissier'}</span>
            <span className="text-[10px] uppercase font-bold px-1.5 py-0.2 rounded bg-gray-100 text-gray-600 border border-gray-200">
              {user?.role}
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
          </button>

          {showUserMenu && (
            <div className="absolute right-0 mt-1 w-56 bg-white border border-gray-200 rounded-lg shadow-lg p-1.5 z-50 animate-in fade-in">
              <div className="px-2 py-1 border-b border-gray-100 mb-1">
                <span className="text-[11px] font-semibold text-gray-500 uppercase">Mon Compte</span>
              </div>
              <div className="space-y-0.5">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center space-x-2 px-2 py-2 rounded text-left text-xs text-red-600 hover:bg-red-50 font-semibold transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Se déconnecter</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
