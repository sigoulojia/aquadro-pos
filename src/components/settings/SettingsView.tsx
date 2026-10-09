// Aquadro POS Algérie V2 — Paramètres du Système & Configuration Fiscale
// Design sobre blanc ERP, gestion profil fiscal DGI (IFU / Régime Réel), imprimantes 58/80mm, sauvegardes & sync

import React, { useState, useEffect } from 'react';
import { printerService } from '../../services/printer.service';
import { backupService } from '../../services/backup.service';
import { syncService } from '../../services/sync.service';
import { authService } from '../../services/auth.service';
import { db } from '../../db/sqlite';
import { invoke as tauriInvoke } from '@tauri-apps/api/core';

const isTauri = typeof window !== 'undefined' && typeof (window as any).__TAURI_INTERNALS__?.invoke === 'function';

async function invoke(cmd: string, args?: any): Promise<any> {
  if (isTauri) {
    return await tauriInvoke(cmd, args);
  }
  console.warn(`[Web Mode] Mocking Tauri invoke for: ${cmd}`);
  if (cmd === 'verify_danger_zone') return true;
  return {};
}
import { Store, FiscalProfile } from '../../types/database';
import { useToast } from '../common/Toast';
import { AlgeriaCities } from '../../data/AlgeriaCities';
import {
  Store as StoreIcon,
  FileSpreadsheet,
  Printer,
  Database,
  Cloud,
  CheckCircle2,
  Save,
  RotateCcw,
  Upload,
  Download,
  AlertTriangle,
  AlertCircle,
  Trash2
} from 'lucide-react';

import { updateService, UpdateState } from '../../services/update.service';

type TabKey = 'store' | 'fiscal' | 'hardware' | 'backup' | 'sync' | 'updates';

export const SettingsView: React.FC = () => {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<TabKey>('store');
  const [updateState, setUpdateState] = useState<UpdateState>(updateService.getState());

  useEffect(() => {
    const unsub = updateService.subscribe((state) => {
      setUpdateState(state);
    });
    return () => unsub();
  }, []);

  // Modal Danger Zone
  const [showDangerModal, setShowDangerModal] = useState(false);
  const [hasAgreed, setHasAgreed] = useState(false);
  const [dangerPin, setDangerPin] = useState('');

  // État Magasin & Fiscalité
  const [store, setStore] = useState<Partial<Store>>({
    name_fr: '',
    name_ar: '',
    address: '',
    wilaya: '',
    commune: '',
    phone: '',
    rc_number: '',
    nif_number: '',
    nis_number: '',
    activity: '',
    fiscal_regime: 'IFU',
    default_tva_rate: 0
  });

  useEffect(() => {
    invoke('get_store').then(storeData => {
      if (storeData) {
        setStore(storeData);
      }
    }).catch(err => console.error("Error loading store:", err));
  }, []);

  // Logo du Magasin
  const [storeLogo, setStoreLogo] = useState<string | null>(null);

  // Imprimante
  const [printerPaperSize, setPrinterPaperSize] = useState<'58mm' | '80mm'>('80mm');
  const [autoPrintReceipt, setAutoPrintReceipt] = useState<boolean>(true);

  // Sauvegarde & Restauration
  const [ownerPinForRestore, setOwnerPinForRestore] = useState<string>('');
  const [restoreJson, setRestoreJson] = useState<string>('');
  const [pendingSyncCount, setPendingSyncCount] = useState<number>(0);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const storeData = await invoke('get_store');
      if (storeData) {
        setStore(storeData);
      }
      const count = await syncService.getPendingCount();
      setPendingSyncCount(count);
      
      const savedLogo = localStorage.getItem('aquadro_store_logo');
      if (savedLogo) setStoreLogo(savedLogo);
    } catch (err) {
      console.error('Erreur chargement paramètres:', err);
    }
  };

  const handleSaveStore = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await invoke('update_store', {
        store: {
          id: store.id || 'store-alg-01',
          name_fr: store.name_fr || '',
          name_ar: store.name_ar || '',
          wilaya: store.wilaya || '',
          commune: store.commune || '',
          address: store.address || '',
          phone: store.phone || '',
          email: store.email || null,
          rc_number: store.rc_number || '',
          nif_number: store.nif_number || '',
          nis_number: store.nis_number || '',
          ai_number: store.ai_number || 'AI-0000',
          fiscal_regime: store.fiscal_regime || 'IFU',
          default_tva_rate: store.fiscal_regime === 'IFU' ? 0 : (store.default_tva_rate || 0),
          receipt_header: store.receipt_header || null,
          receipt_footer: store.receipt_footer || null,
          currency: store.currency || 'DZD',
          is_active: store.is_active !== undefined ? store.is_active : 1,
          created_at: store.created_at || new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      });
      showToast('Configuration magasin enregistrée avec succès', 'success');
    } catch (err: any) {
      showToast(`Erreur : ${err.message}`, 'error');
    }
  };

  const handleTestPrint = async () => {
    try {
      await printerService.printReceipt({
        storeName: store.name_fr || 'Aquadro POS',
        storeAddress: store.address || 'Alger',
        storePhone: store.phone || '0550 00 00 00',
        receiptNumber: 'TKT-TEST-0001',
        dateTime: new Date().toLocaleString('fr-FR'),
        cashierName: 'Testeur POS',
        items: [
          { name: 'Produit Test A', quantity: 1, unitPrice: 16500, total: 16500 },
          { name: 'Produit Test B', quantity: 1, unitPrice: 4200, total: 4200 }
        ],
        subtotal: 20700,
        discountTotal: 0,
        taxAmount: store.fiscal_regime === 'REEL' ? 3305 : 0,
        taxRate: store.fiscal_regime === 'REEL' ? 19 : 0,
        grandTotal: 20700,
        payments: [{ method: 'CASH', amount: 20700, tendered: 21000, change: 300 }],
        footerMessage: 'Merci pour votre confiance ! Compléments garantis 100% originaux.'
      });
      showToast('Ticket de test envoyé au gestionnaire d\'impression', 'info');
    } catch (err: any) {
      showToast(`Erreur impression : ${err.message}`, 'error');
    }
  };

  const handleTestDrawer = async () => {
    try {
      await printerService.kickCashDrawer();
      showToast('Signal impulsion RJ11 envoyé au tiroir-caisse', 'info');
    } catch (err: any) {
      showToast(`Erreur tiroir-caisse : ${err.message}`, 'error');
    }
  };

  const handleExportBackup = async () => {
    try {
      const meta = await backupService.createBackup();
      showToast(`Sauvegarde exportée avec succès (${meta.filename})`, 'success');
    } catch (err: any) {
      showToast(`Erreur sauvegarde : ${err.message}`, 'error');
    }
  };

  const handleImportBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async event => {
      const content = event.target?.result as string;
      setRestoreJson(content);
      showToast('Fichier de sauvegarde chargé. Veuillez entrer le code PIN Propriétaire pour restaurer.', 'info');
    };
    reader.readAsText(file);
  };

  const handleExecuteRestore = async () => {
    if (!restoreJson) {
      showToast('Veuillez d\'abord charger un fichier de sauvegarde JSON valide.', 'warning');
      return;
    }
    if (!ownerPinForRestore) {
      showToast('Veuillez renseigner le code PIN Propriétaire.', 'warning');
      return;
    }

    try {
      await backupService.restoreBackup(restoreJson, ownerPinForRestore);
      showToast('Base de données restaurée avec succès ! Rechargement...', 'success');
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (err: any) {
      showToast(`Erreur restauration : ${err.message}`, 'error');
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setStoreLogo(base64);
      localStorage.setItem('aquadro_store_logo', base64);
      showToast('Logo du magasin mis à jour', 'success');
    };
    reader.readAsDataURL(file);
  };

  const handleFullFactoryReset = async () => {
    try {
      const token = authService.getSessionToken();
      if (!token) {
        showToast('Session introuvable.', 'error');
        return;
      }
      
      // Rust va vérifier si le token appartient à un admin/owner ET si le secret est bon dans le Keyring
      const valid = await invoke('verify_danger_zone', { secret: dangerPin, token });
      if (!valid) return;
      
      showToast('Création de la sauvegarde en cours...', 'info');
      await backupService.createBackup();
      
      showToast('Effacement de la base de données en cours...', 'info');
      await import('../../db/sqlite').then(async ({ db }) => {
        await db.resetAll();
      });

      localStorage.removeItem('aquadro_setup_completed');
      localStorage.removeItem('aquadro_store_logo');
      
      showToast('Système réinitialisé. Redémarrage...', 'success');
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (error: any) {
      showToast(`Erreur d'accès Danger Zone: ${error}`, 'error');
    }
  };

  return (
    <div className="flex-1 bg-gray-100 p-4 flex flex-col overflow-hidden text-xs select-none">
      {/* En-tête */}
      <div className="flex items-center justify-between pb-3">
        <div>
          <h2 className="text-base font-bold text-gray-900">Paramètres Généraux du Système</h2>
          <span className="text-[11px] text-gray-500">
            Profil fiscal algérien DGI, matériel caisse, sauvegardes locales et synchronisation
          </span>
        </div>
      </div>

      {/* Onglets blancs épurés */}
      <div className="flex space-x-1 border-b border-gray-200 bg-white px-3 pt-2 rounded-t border">
        <button
          onClick={() => setActiveTab('store')}
          className={`px-3 py-2 font-bold flex items-center space-x-2 border-b-2 text-xs transition-colors ${
            activeTab === 'store'
              ? 'border-blue-600 text-blue-700 bg-blue-50/40'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          <StoreIcon className="w-4 h-4" />
          <span>Fiche Magasin</span>
        </button>

        <button
          onClick={() => setActiveTab('fiscal')}
          className={`px-3 py-2 font-bold flex items-center space-x-2 border-b-2 text-xs transition-colors ${
            activeTab === 'fiscal'
              ? 'border-blue-600 text-blue-700 bg-blue-50/40'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>Régime Fiscal DGI</span>
        </button>

        <button
          onClick={() => setActiveTab('hardware')}
          className={`px-3 py-2 font-bold flex items-center space-x-2 border-b-2 text-xs transition-colors ${
            activeTab === 'hardware'
              ? 'border-blue-600 text-blue-700 bg-blue-50/40'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          <Printer className="w-4 h-4" />
          <span>Matériel & Caisse</span>
        </button>

        <button
          onClick={() => setActiveTab('backup')}
          className={`px-3 py-2 font-bold flex items-center space-x-2 border-b-2 text-xs transition-colors ${
            activeTab === 'backup'
              ? 'border-blue-600 text-blue-700 bg-blue-50/40'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          <Database className="w-4 h-4" />
          <span>Sauvegardes Locales</span>
        </button>

        <button
          onClick={() => setActiveTab('sync')}
          className={`px-3 py-2 font-bold flex items-center space-x-2 border-b-2 text-xs transition-colors ${
            activeTab === 'sync'
              ? 'border-blue-600 text-blue-700 bg-blue-50/40'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          <Cloud className="w-4 h-4" />
          <span>Synchronisation Cloud</span>
        </button>

        <button
          onClick={() => setActiveTab('updates')}
          className={`px-3 py-2 font-bold flex items-center space-x-2 border-b-2 text-xs transition-colors ${
            activeTab === 'updates'
              ? 'border-blue-600 text-blue-700 bg-blue-50/40'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          <RotateCcw className="w-4 h-4" />
          <span>Mises à Jour</span>
          {updateState.status === 'available' && (
            <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
          )}
        </button>
      </div>

      {/* Contenu principal */}
      <div className="flex-1 bg-white border border-gray-200 border-t-0 p-5 overflow-y-auto rounded-b">
        {/* TAB 1: IDENTITÉ MAGASIN */}
        {activeTab === 'store' && (
          <form onSubmit={handleSaveStore} className="max-w-3xl space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-gray-700 font-bold mb-1">Raison Sociale (Français)</label>
                <input
                  type="text"
                  value={store.name_fr || ''}
                  onChange={e => setStore({ ...store, name_fr: e.target.value })}
                  className="w-full p-2 border border-gray-300 rounded text-xs text-gray-900"
                  required
                />
              </div>
              <div>
                <label className="block text-gray-700 font-bold mb-1">الاسم التجاري (بالعربية)</label>
                <input
                  type="text"
                  value={store.name_ar || ''}
                  onChange={e => setStore({ ...store, name_ar: e.target.value })}
                  className="w-full p-2 border border-gray-300 rounded text-xs text-gray-900 text-right"
                  dir="rtl"
                />
              </div>
            </div>

            {/* Upload Logo */}
            <div className="pt-2 pb-2 border-b border-gray-100">
              <label className="block text-gray-700 font-bold mb-2">Logo du Magasin (Pour Impression sur Ticket)</label>
              <div className="flex items-center space-x-4">
                {storeLogo ? (
                  <div className="relative w-20 h-20 border border-gray-200 rounded p-1 bg-gray-50 flex items-center justify-center">
                    <img src={storeLogo} alt="Logo" className="max-w-full max-h-full object-contain" />
                    <button
                      type="button"
                      onClick={() => {
                        setStoreLogo(null);
                        localStorage.removeItem('aquadro_store_logo');
                      }}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5 shadow hover:bg-red-600"
                    >
                      <AlertTriangle className="w-3 h-3 hidden" /> {/* Just to ignore unused import if needed */}
                      <span className="w-4 h-4 flex items-center justify-center text-xs">x</span>
                    </button>
                  </div>
                ) : (
                  <div className="w-20 h-20 border-2 border-dashed border-gray-300 rounded bg-gray-50 flex flex-col items-center justify-center text-gray-400">
                    <StoreIcon className="w-6 h-6 mb-1" />
                    <span className="text-[9px]">Aucun logo</span>
                  </div>
                )}
                <div className="flex-1">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    className="block w-full text-xs text-gray-500 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                  />
                  <p className="text-[10px] text-gray-500 mt-1">
                    L'image sera convertie en noir et blanc pour l'imprimante thermique. Format carré recommandé.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-gray-700 font-bold mb-1">Wilaya</label>
                <select
                  value={store.wilaya || ''}
                  onChange={e => {
                    const selectedWilaya = e.target.value;
                    let newCommune = store.commune;
                    if (selectedWilaya) {
                      const wilayaCode = parseInt(selectedWilaya.split(' - ')[0], 10);
                      const communes = AlgeriaCities.getCommunes(wilayaCode);
                      if (communes.length > 0) newCommune = communes[0];
                    }
                    setStore({ ...store, wilaya: selectedWilaya, commune: newCommune });
                  }}
                  className="w-full p-2 border border-gray-300 rounded text-xs text-gray-900 bg-white"
                >
                  <option value="">Sélectionner une wilaya</option>
                  {AlgeriaCities.getWilayas().map(w => (
                    <option key={w.code} value={w.label}>{w.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-gray-700 font-bold mb-1">Commune / Daira</label>
                <select
                  value={store.commune || ''}
                  onChange={e => setStore({ ...store, commune: e.target.value })}
                  className="w-full p-2 border border-gray-300 rounded text-xs text-gray-900 bg-white"
                >
                  {store.wilaya ? (
                    AlgeriaCities.getCommunes(parseInt(store.wilaya.split(' - ')[0], 10)).map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))
                  ) : (
                    <option value="">Sélectionnez d'abord une wilaya</option>
                  )}
                </select>
              </div>
              <div>
                <label className="block text-gray-700 font-bold mb-1">Téléphone Magasin</label>
                <input
                  type="text"
                  value={store.phone || ''}
                  onChange={e => setStore({ ...store, phone: e.target.value })}
                  className="w-full p-2 border border-gray-300 rounded text-xs text-gray-900"
                />
              </div>
            </div>

            <div>
              <label className="block text-gray-700 font-bold mb-1">Adresse Complète</label>
              <input
                type="text"
                value={store.address || ''}
                onChange={e => setStore({ ...store, address: e.target.value })}
                className="w-full p-2 border border-gray-300 rounded text-xs text-gray-900"
              />
            </div>

            <div className="grid grid-cols-3 gap-4 pt-2 border-t border-gray-100">
              <div>
                <label className="block text-gray-700 font-bold mb-1">Registre de Commerce (RC)</label>
                <input
                  type="text"
                  value={store.rc_number || ''}
                  onChange={e => setStore({ ...store, rc_number: e.target.value })}
                  className="w-full p-2 border border-gray-300 rounded text-xs font-mono text-gray-900"
                  placeholder="16/00-1234567B22"
                />
              </div>
              <div>
                <label className="block text-gray-700 font-bold mb-1">NIF (Identification Fiscale)</label>
                <input
                  type="text"
                  value={store.nif_number || ''}
                  onChange={e => setStore({ ...store, nif_number: e.target.value })}
                  className="w-full p-2 border border-gray-300 rounded text-xs font-mono text-gray-900"
                  placeholder="002216012345678"
                />
              </div>
              <div>
                <label className="block text-gray-700 font-bold mb-1">NIS (Identification Statistique)</label>
                <input
                  type="text"
                  value={store.nis_number || ''}
                  onChange={e => setStore({ ...store, nis_number: e.target.value })}
                  className="w-full p-2 border border-gray-300 rounded text-xs font-mono text-gray-900"
                  placeholder="002216010001234"
                />
              </div>
            </div>

            <div>
              <label className="block text-gray-700 font-bold mb-1">Activité Commerciale Déclarée</label>
              <input
                type="text"
                value={store.activity || ''}
                onChange={e => setStore({ ...store, activity: e.target.value })}
                className="w-full p-2 border border-gray-300 rounded text-xs text-gray-900"
              />
            </div>

            <div className="pt-3">
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded flex items-center space-x-1.5"
              >
                <Save className="w-4 h-4" />
                <span>Enregistrer les coordonnées</span>
              </button>
            </div>
          </form>
        )}

        {/* TAB 2: RÉGIME FISCAL DGI */}
        {activeTab === 'fiscal' && (
          <form onSubmit={handleSaveStore} className="max-w-2xl space-y-4">
            <div className="p-3 bg-blue-50 border border-blue-200 rounded text-blue-900 text-xs">
              <span className="font-bold">Directive DGI Algérie :</span>
              <p className="mt-1 text-[11px] leading-relaxed">
                Les commerçants assujettis à l'<strong>IFU (Impôt Forfaitaire Unique)</strong> ne facturent pas de TVA 
                et émettent des tickets/factures en prix TTC direct. 
                Les assujettis au <strong>Régime Réel</strong> appliquent les taux légaux en vigueur (Taux Normal 19%, Taux Réduit 9%, ou Exonéré 0%).
              </p>
            </div>

            <div className="space-y-3">
              <label className="block text-gray-800 font-bold">Sélection du Régime d'Imposition :</label>

              <div className="flex items-center space-x-4 p-3 border border-gray-200 rounded bg-gray-50">
                <input
                  type="radio"
                  id="regime-ifu"
                  name="fiscal_regime"
                  value="IFU"
                  checked={store.fiscal_regime === 'IFU'}
                  onChange={() => setStore({ ...store, fiscal_regime: 'IFU', default_tva_rate: 0 })}
                  className="w-4 h-4 text-blue-600"
                />
                <label htmlFor="regime-ifu" className="cursor-pointer">
                  <div className="font-bold text-gray-900">Régime IFU (Impôt Forfaitaire Unique)</div>
                  <div className="text-[11px] text-gray-500">
                    Non assujetti à la TVA. Ventes directes en TTC. Recommandé pour la majorité des boutiques de détail.
                  </div>
                </label>
              </div>

              <div className="flex items-center space-x-4 p-3 border border-gray-200 rounded bg-gray-50">
                <input
                  type="radio"
                  id="regime-reel"
                  name="fiscal_regime"
                  value="REEL"
                  checked={store.fiscal_regime === 'REEL'}
                  onChange={() => setStore({ ...store, fiscal_regime: 'REEL', default_tva_rate: 19 })}
                  className="w-4 h-4 text-blue-600"
                />
                <label htmlFor="regime-reel" className="cursor-pointer">
                  <div className="font-bold text-gray-900">Régime Réel (Assujetti à la TVA)</div>
                  <div className="text-[11px] text-gray-500">
                    Décomposition HT + TVA (19% standard ou 9% réduit) avec mention obligatoire sur factures.
                  </div>
                </label>
              </div>
            </div>

            {store.fiscal_regime === 'REEL' && (
              <div className="p-3 border border-gray-200 rounded bg-white space-y-2">
                <label className="block text-gray-800 font-bold">Taux de TVA par défaut pour les compléments :</label>
                <select
                  value={store.default_tva_rate || 19}
                  onChange={e => setStore({ ...store, default_tva_rate: parseFloat(e.target.value) })}
                  className="p-2 border border-gray-300 rounded text-xs text-gray-900 bg-white"
                >
                  <option value={19}>19% — Taux Normal (Compléments alimentaires, Shakers, Vêtements)</option>
                  <option value={9}>9% — Taux Réduit (Produits diététiques de base spécifiques)</option>
                  <option value={0}>0% — Exonéré</option>
                </select>
              </div>
            )}

            <div className="pt-2">
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded flex items-center space-x-1.5"
              >
                <Save className="w-4 h-4" />
                <span>Appliquer le profil fiscal</span>
              </button>
            </div>
          </form>
        )}

        {/* TAB 3: MATÉRIEL & CAISSE */}
        {activeTab === 'hardware' && (
          <div className="max-w-2xl space-y-5">
            <div>
              <h3 className="font-bold text-gray-900 text-sm mb-1">Imprimante Thermique Ticket de Caisse</h3>
              <p className="text-[11px] text-gray-500 mb-3">
                Prend en charge les formats ESC/POS standard (58mm et 80mm) et les tiroirs-caisses connectés via RJ11.
              </p>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 border border-gray-200 rounded bg-gray-50">
                  <label className="block text-gray-700 font-bold mb-1">Format de papier ticket :</label>
                  <select
                    value={printerPaperSize}
                    onChange={e => setPrinterPaperSize(e.target.value as any)}
                    className="w-full p-2 border border-gray-300 rounded text-xs bg-white text-gray-900"
                  >
                    <option value="80mm">80 mm (Recommandé - Format standard avec logo et détails)</option>
                    <option value="58mm">58 mm (Format compact économique)</option>
                  </select>
                </div>

                <div className="p-3 border border-gray-200 rounded bg-gray-50 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-gray-800">Impression automatique</div>
                    <div className="text-[11px] text-gray-500">Imprimer le ticket dès la validation de vente</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={autoPrintReceipt}
                    onChange={e => setAutoPrintReceipt(e.target.checked)}
                    className="w-4 h-4 text-blue-600"
                  />
                </div>
              </div>

              <div className="flex space-x-3 mt-3">
                <button
                  type="button"
                  onClick={handleTestPrint}
                  className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold rounded border border-gray-300 flex items-center space-x-1.5"
                >
                  <Printer className="w-4 h-4 text-gray-600" />
                  <span>Imprimer un ticket de test DZD</span>
                </button>

                <button
                  type="button"
                  onClick={handleTestDrawer}
                  className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold rounded border border-gray-300 flex items-center space-x-1.5"
                >
                  <RotateCcw className="w-4 h-4 text-gray-600" />
                  <span>Tester l'ouverture du tiroir-caisse</span>
                </button>
              </div>
            </div>

            <div className="pt-4 border-t border-gray-200">
              <h3 className="font-bold text-gray-900 text-sm mb-1">Coupures de Billets en Caisse (Dinars Algériens)</h3>
              <p className="text-[11px] text-gray-500 mb-2">
                Coupures prises en compte pour le comptage de fond de caisse et de clôture Z :
              </p>
              <div className="flex flex-wrap gap-2">
                {['200 DA', '500 DA', '1 000 DA', '2 000 DA', 'Pièces de monnaie'].map((den, idx) => (
                  <span key={idx} className="px-2.5 py-1 bg-gray-100 border border-gray-300 rounded font-mono font-bold text-gray-700">
                    {den}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: SAUVEGARDES LOCALES & RESTAURATION */}
        {activeTab === 'backup' && (
          <div className="max-w-2xl space-y-5">
            <div>
              <h3 className="font-bold text-gray-900 text-sm mb-1">Sauvegardes Locales de la Base de Données</h3>
              <p className="text-[11px] text-gray-500 mb-3">
                Exportez une copie intégrale et autonome du grand livre SQLite (catalogue, stocks, lots FEFO, ventes et caisses).
              </p>

              <button
                type="button"
                onClick={handleExportBackup}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded flex items-center space-x-2"
              >
                <Download className="w-4 h-4" />
                <span>Exporter la sauvegarde locale (Fichier JSON)</span>
              </button>
            </div>

            <div className="pt-4 border-t border-gray-200">
              <h3 className="font-bold text-gray-900 text-sm mb-1 text-red-700 flex items-center space-x-1.5">
                <AlertTriangle className="w-4 h-4" />
                <span>Zone Sensible : Restauration d'une Sauvegarde</span>
              </h3>
              <p className="text-[11px] text-gray-500 mb-3">
                La restauration remplace les données locales par le contenu du fichier sélectionné. Cette opération exige obligatoirement le <strong>Code PIN du Propriétaire</strong>.
              </p>

              <div className="space-y-3 bg-red-50/50 border border-red-200 p-3 rounded">
                <div>
                  <label className="block text-gray-700 font-bold mb-1">Sélectionner le fichier JSON de sauvegarde :</label>
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleImportBackup}
                    className="block w-full text-xs text-gray-500 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-gray-200 file:text-gray-700 hover:file:bg-gray-300"
                  />
                </div>

                <div>
                  <label className="block text-gray-700 font-bold mb-1">Code PIN Propriétaire (Owner PIN) :</label>
                  <input
                    type="password"
                    maxLength={8}
                    value={ownerPinForRestore}
                    onChange={e => setOwnerPinForRestore(e.target.value)}
                    placeholder="Saisissez le PIN propriétaire..."
                    className="w-64 p-2 border border-gray-300 rounded text-xs bg-white text-gray-900 font-mono"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleExecuteRestore}
                  disabled={!restoreJson || !ownerPinForRestore}
                  className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded disabled:opacity-50 flex items-center space-x-1.5"
                >
                  <Upload className="w-4 h-4" />
                  <span>Exécuter la Restauration des Données</span>
                </button>
              </div>
            </div>

            {/* DANGER ZONE : Réinitialisation */}
            <div className="bg-red-50 border border-red-200 rounded-lg overflow-hidden mt-6">
              <div className="p-4 border-b border-red-200 flex items-center space-x-2">
                <AlertCircle className="w-5 h-5 text-red-600" />
                <span className="font-bold text-red-900">Zone de Danger : Réinitialisation Système</span>
              </div>
              <div className="p-4 space-y-4">
                <p className="text-xs text-red-800">
                  ATTENTION : Cette action effacera immédiatement toutes les transactions (ventes, sessions de caisse, règlements) et remettra la base de données à zéro (état d'usine initial). Cette action est IRRÉVERSIBLE.
                </p>
                
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm("Voulez-vous effacer uniquement les transactions (ventes, dépenses, outbox) et garder vos produits, clients, et paramètres ?")) {
                      import('../../db/sqlite').then(async ({ db }) => {
                        await db.resetTransactionsOnly();
                        alert("Les transactions ont été effacées. La page va se recharger.");
                        window.location.reload();
                      });
                    }
                  }}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded shadow-sm flex items-center space-x-2 transition-colors w-full"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Vider les Transactions Seulement (Garder le catalogue)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowDangerModal(true)}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded shadow-sm flex items-center space-x-2 transition-colors w-full"
                >
                  <AlertTriangle className="w-4 h-4" />
                  <span>Formatage complet (Repartir à zéro avec l'assistant)</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: SYNCHRONISATION CLOUD */}
        {activeTab === 'sync' && (
          <div className="max-w-2xl space-y-4">
            <h3 className="font-bold text-gray-900 text-sm mb-1">File d'attente de synchronisation locale (Outbox SQLite)</h3>
            <p className="text-[11px] text-gray-500">
              Le logiciel est 100% autonome et fonctionne sans connexion Internet. Dès qu'une connexion réseau est active, 
              les opérations enregistrées sont synchronisées avec le serveur central PostgreSQL / Supabase de façon idempotente.
            </p>

            <div className="p-3 border border-gray-200 rounded bg-gray-50 flex items-center justify-between">
              <div>
                <span className="font-bold text-gray-800">Opérations en attente de synchronisation :</span>
                <p className="text-[11px] text-gray-500">Transactions de vente, réceptions de stock, mouvements FEFO</p>
              </div>
              <span className="text-sm font-mono font-bold px-3 py-1 bg-white border border-gray-300 rounded text-gray-800">
                {pendingSyncCount} en attente
              </span>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={async () => {
                  await syncService.processSyncQueue();
                  const count = await syncService.getPendingCount();
                  setPendingSyncCount(count);
                  showToast('File de synchronisation traitée avec succès', 'success');
                }}
                className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded flex items-center space-x-1.5"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Synchroniser manuellement maintenant</span>
              </button>
            </div>
          </div>
        )}

        {/* TAB 6: MISES À JOUR DU SYSTÈME */}
        {activeTab === 'updates' && (
          <div className="max-w-3xl space-y-6">
            <div>
              <h3 className="text-sm font-bold text-gray-900 border-b pb-2">
                Mises à Jour Automatiques & Intégrité du Système
              </h3>
              <p className="text-xs text-gray-500 mt-1">
                Aquadro POS utilise le moteur officiel Tauri 2 Updater avec vérification cryptographique Minisign et téléchargement HTTPS sécurisé.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="border border-gray-200 rounded p-4 bg-gray-50/50">
                <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider block">Version Installée</span>
                <p className="text-lg font-bold text-gray-900 font-mono mt-0.5">v1.0.0</p>
                <span className="text-[11px] text-green-700 font-medium flex items-center gap-1 mt-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Canal Production Stable (NSIS Windows)
                </span>
              </div>

              <div className="border border-gray-200 rounded p-4 bg-gray-50/50">
                <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider block">Dernière vérification</span>
                <p className="text-xs font-mono text-gray-700 mt-1">
                  {updateState.lastChecked ? new Date(updateState.lastChecked).toLocaleString() : 'Jamais vérifié'}
                </p>
                <span className="text-[11px] text-gray-500 block mt-1">
                  Endpoint : GitHub Releases HTTPS
                </span>
              </div>
            </div>

            {/* État de la mise à jour */}
            {updateState.status === 'checking' && (
              <div className="flex items-center gap-3 p-4 bg-blue-50 border border-blue-200 rounded text-blue-900 text-xs">
                <RotateCcw className="w-4 h-4 animate-spin text-blue-600" />
                <span>Recherche de nouvelles versions publiées en cours...</span>
              </div>
            )}

            {updateState.status === 'available' && updateState.updateInfo && (
              <div className="p-4 bg-indigo-50 border border-indigo-200 rounded space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 animate-ping" />
                    <span className="font-bold text-sm text-indigo-900">
                      Mise à jour v{updateState.updateInfo.version} disponible !
                    </span>
                  </div>
                </div>

                {updateState.updateInfo.body && (
                  <div className="p-3 bg-white border border-indigo-100 rounded text-xs text-gray-700 font-mono whitespace-pre-line max-h-32 overflow-y-auto">
                    {updateState.updateInfo.body}
                  </div>
                )}

                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await updateService.downloadAndInstall();
                    } catch (e: any) {
                      showToast(`Erreur mise à jour: ${e.message}`, 'error');
                    }
                  }}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  <span>Télécharger et installer maintenant</span>
                </button>
              </div>
            )}

            {updateState.status === 'downloading' && (
              <div className="p-4 bg-blue-50 border border-blue-200 rounded space-y-2">
                <div className="flex justify-between text-xs font-bold text-blue-900">
                  <span>Téléchargement en cours...</span>
                  <span>{updateState.progress.percent}%</span>
                </div>
                <div className="w-full bg-blue-200 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all"
                    style={{ width: `${updateState.progress.percent}%` }}
                  />
                </div>
              </div>
            )}

            {updateState.status === 'up-to-date' && (
              <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded text-green-800 text-xs font-medium">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                <span>Votre système Aquadro POS est parfaitement à jour (v1.0.0).</span>
              </div>
            )}

            {updateState.error && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded text-amber-900 text-xs space-y-1">
                <div className="flex items-center gap-2 font-bold">
                  <AlertCircle className="w-4 h-4 text-amber-600" />
                  <span>Information de mise à jour</span>
                </div>
                <p className="text-amber-800">{updateState.error}</p>
              </div>
            )}

            <div className="pt-2">
              <button
                type="button"
                onClick={async () => {
                  try {
                    const info = await updateService.checkForUpdates(false);
                    if (!info) {
                      showToast('Votre système Aquadro POS est à jour', 'info');
                    } else {
                      showToast(`Nouvelle version v${info.version} détectée !`, 'success');
                    }
                  } catch (e: any) {
                    showToast(`Échec de la recherche: ${e.message}`, 'error');
                  }
                }}
                disabled={updateState.status === 'checking' || updateState.status === 'downloading'}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs rounded flex items-center space-x-2"
              >
                <RotateCcw className={`w-4 h-4 ${updateState.status === 'checking' ? 'animate-spin' : ''}`} />
                <span>Rechercher les mises à jour maintenant</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* MODAL DANGER ZONE FACTORY RESET */}
      {showDangerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded shadow-2xl max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 bg-red-600 text-white flex items-center space-x-2">
              <AlertTriangle className="w-6 h-6" />
              <h2 className="text-lg font-bold">DANGER ZONE : FACTORY RESET</h2>
            </div>
            
            <div className="p-5 overflow-y-auto flex-1">
              <h3 className="font-bold text-gray-900 text-base mb-2">ميثاق الاستخدام</h3>
              <div className="text-sm text-gray-700 text-right direction-rtl space-y-2 border border-gray-200 p-4 rounded bg-gray-50 mb-4 h-48 overflow-y-auto">
                <p>بموافقتك على استخدام هذا النظام (Aquadro POS)، فإنك تتعهد وتوافق على الميثاق التالي:</p>
                <ul className="list-disc pr-5 space-y-1">
                  <li>النظام مصمم لتسهيل عمليات البيع والإدارة، ولا يتحمل المطور أي مسؤولية عن أخطاء إدخال البيانات أو ضياعها.</li>
                  <li>رمز قاعدة البيانات (DB PIN) هو مسؤوليتك الخاصة. فقدانه أو تسريبه قد يؤدي إلى فقدان بياناتك بالكامل في حال عمل Reset.</li>
                  <li>عند قيامك بطلب (Factory Reset)، توافق على أن النظام سيقوم بمسح كافة البيانات من الجهاز نهائياً بعد استخراج نسخة احتياطية.</li>
                  <li>يمنع منعاً باتاً الهندسة العكسية للبرنامج أو توزيعه بدون إذن مسبق من المطور بوضلعة يوسف الصديق.</li>
                </ul>
                <p className="mt-4 font-bold">تطوير: بوضلعة يوسف الصديق (Boudelaa Youcef Seddik)</p>
              </div>

              <label className="flex items-start space-x-2 cursor-pointer mb-6 border-b border-gray-200 pb-4">
                <input
                  type="checkbox"
                  checked={hasAgreed}
                  onChange={e => setHasAgreed(e.target.checked)}
                  className="mt-1 rounded text-red-600 focus:ring-red-500 w-4 h-4"
                />
                <span className="text-sm font-bold text-gray-900">
                  هل أنت موافق على هذا الميثاق ومستعد لحذف جميع البيانات والعودة لنقطة الصفر؟
                </span>
              </label>

              {hasAgreed && (
                <div className="space-y-2 animate-in fade-in duration-300">
                  <label className="block text-gray-800 font-bold text-sm">أدخل الرمز السري لقاعدة البيانات (DB SECRET PIN):</label>
                  <p className="text-[11px] text-gray-500 mb-2">تم طباعة هذا الرمز عند أول تشغيل وتفعيل للبرنامج.</p>
                  <input
                    type="password"
                    value={dangerPin}
                    onChange={e => setDangerPin(e.target.value)}
                    placeholder="رمز قاعدة البيانات..."
                    className="w-full p-2 border border-gray-300 rounded text-center text-xl font-mono tracking-widest text-gray-900 focus:border-red-500 focus:ring-red-500"
                  />
                </div>
              )}
            </div>

            <div className="p-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  setShowDangerModal(false);
                  setHasAgreed(false);
                  setDangerPin('');
                }}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold rounded"
              >
                إلغاء
              </button>
              
              <button
                type="button"
                onClick={handleFullFactoryReset}
                disabled={!hasAgreed || dangerPin.length < 4}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded flex items-center space-x-2 disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                <span>تنزيل نسخة ثم مسح كل شيء</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
