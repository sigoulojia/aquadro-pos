// Aquadro POS Algérie V2 — Application Principale Desktop ERP
// Architecture 100% sobre, blanche, dense et professionnelle pour commerces de détail en Algérie

import React, { useState, useEffect } from 'react';
import { I18nProvider } from './i18n';
import { ToastProvider } from './components/common/Toast';
import { Navbar } from './components/common/Navbar';
import { Sidebar, NavView } from './components/common/Sidebar';
import { PosView } from './components/pos/PosView';
import { DashboardView } from './components/dashboard/DashboardView';
import { ProductsView } from './components/products/ProductsView';
import { InventoryView } from './components/inventory/InventoryView';
import { PurchasesView } from './components/purchases/PurchasesView';
import { SalesView } from './components/sales/SalesView';
import { CustomersView } from './components/customers/CustomersView';
import { SuppliersView } from './components/suppliers/SuppliersView';
import { CaisseView } from './components/caisse/CaisseView';
import { ExpensesView } from './components/expenses/ExpensesView';
import { ReportsView } from './components/reports/ReportsView';
import { DocumentsView } from './components/documents/DocumentsView';
import { JournalView } from './components/journal/JournalView';
import { CreditsView } from './components/credits/CreditsView';
import { UsersView } from './components/users/UsersView';
import { SettingsView } from './components/settings/SettingsView';
import { AIAssistantDrawer } from './components/ai/AIAssistantDrawer';
import { SetupWizard } from './components/setup/SetupWizard';
import { LoginView } from './components/auth/LoginView';
import { db } from './db/sqlite';
import { authService } from './services/auth.service';
import { User } from './types/database';
import { RotateCcw } from 'lucide-react';

import { UpdateNotificationModal } from './components/common/UpdateNotificationModal';
import { updateService } from './services/update.service';

export const AppContent: React.FC = () => {
  const [currentView, setCurrentView] = useState<NavView>('pos');
  const [isAIOpen, setIsAIOpen] = useState<boolean>(false);
  const [isInitializing, setIsInitializing] = useState<boolean>(true);
  const [showSetup, setShowSetup] = useState<boolean>(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  useEffect(() => {
    const unsubscribe = authService.subscribe((user) => {
      setCurrentUser(user);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const initApp = async () => {
      try {
        await db.initialize();
        await authService.initSession();

        const completed = localStorage.getItem('aquadro_setup_completed');
        if (!completed) {
          setShowSetup(true);
        }
      } catch (err) {
        console.error('Initialization error:', err);
      } finally {
        setIsInitializing(false);
        // Non-blocking silent background update check
        updateService.checkForUpdates(true).catch((err) => {
          console.warn('[App] Silent update check error:', err);
        });
      }
    };
    initApp();
  }, []);

  // Raccourcis clavier globaux POS et Navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Mapping des touches F1-F12 aux vues
      const fKeyMap: Record<string, NavView> = {
        'F1': 'pos',
        'F2': 'dashboard',
        'F3': 'products',
        'F4': 'inventory',
        'F5': 'purchases',
        'F6': 'sales',
        'F7': 'customers',
        'F8': 'credits',
        'F9': 'suppliers',
        'F10': 'caisse',
        'F11': 'expenses',
        'F12': 'journal'
      };

      if (fKeyMap[e.key]) {
        e.preventDefault();
        setCurrentView(fKeyMap[e.key]);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (isInitializing) {
    return (
      <div className="h-screen w-screen bg-gray-100 flex flex-col items-center justify-center text-gray-700 select-none">
        <div className="p-6 bg-white border border-gray-300 rounded shadow-md flex flex-col items-center max-w-sm text-center">
          <RotateCcw className="w-8 h-8 text-blue-600 animate-spin mb-3" />
          <h2 className="text-sm font-bold text-gray-900 tracking-wide uppercase">
            Aquadro POS Algérie V2
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            Chargement du grand livre SQLite local & initialisation des modules métier...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-gray-100 text-gray-900 overflow-hidden font-sans">
      {/* Assistant de premier démarrage (si non complété) */}
      {showSetup && (
        <SetupWizard onComplete={() => setShowSetup(false)} />
      )}

      {!currentUser ? (
        <LoginView />
      ) : (
        <>
          {/* Barre Supérieure Topbar */}
          <Navbar
            onToggleAI={() => setIsAIOpen(!isAIOpen)}
            isAIOpen={isAIOpen}
            onNavigateToSettings={() => setCurrentView('settings')}
          />

          {/* Zone Centrale : Navigation Latérale ERP + Vue Métier Active */}
          <div className="flex-1 flex overflow-hidden">
            <Sidebar
              currentView={currentView}
              onNavigate={(view) => setCurrentView(view)}
            />

            <main className="flex-1 flex overflow-hidden bg-gray-100">
              {currentView === 'pos' && <PosView />}
              {currentView === 'dashboard' && (
                <DashboardView
                  onNavigateToPOS={() => setCurrentView('pos')}
                  onNavigateToInventory={() => setCurrentView('inventory')}
                />
              )}
              {currentView === 'products' && <ProductsView />}
              {currentView === 'inventory' && <InventoryView />}
              {currentView === 'purchases' && <PurchasesView />}
              {currentView === 'sales' && <SalesView />}
              {currentView === 'customers' && <CustomersView />}
              {currentView === 'suppliers' && <SuppliersView />}
              {currentView === 'caisse' && <CaisseView />}
              {currentView === 'expenses' && <ExpensesView />}
              {currentView === 'reports' && <ReportsView />}
              {currentView === 'documents' && <DocumentsView />}
              {currentView === 'credits' && <CreditsView />}
              {currentView === 'journal' && <JournalView />}
              {currentView === 'users' && <UsersView />}
              {currentView === 'settings' && <SettingsView />}
            </main>
          </div>

          {/* Tiroir Assistant IA Copilote */}
          <AIAssistantDrawer
            isOpen={isAIOpen}
            onClose={() => setIsAIOpen(false)}
          />

          {/* Modal de Mise à jour Automatique */}
          <UpdateNotificationModal />
        </>
      )}
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <I18nProvider>
      <ToastProvider>
        <AppContent />
      </ToastProvider>
    </I18nProvider>
  );
};

export default App;
