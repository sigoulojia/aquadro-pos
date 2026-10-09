// Aquadro POS Algérie V2 — Gestion des Sessions de Caisse & Rapport Z
// Contrôle des espèces, comptage par coupures algériennes, détection des écarts et clôture

import React, { useState, useEffect } from 'react';
import { caisseService, ZReportSummary } from '../../services/caisse.service';
import { printerService } from '../../services/printer.service';
import { useAuth } from '../../hooks/useAuth';
import { useI18n } from '../../i18n';
import { useToast } from '../common/Toast';
import { CashSession } from '../../types/database';
import { CurrencyUtil } from '../../core/currency/currency';
import {
  Vault,
  Banknote,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Printer,
  History,
  Lock,
  Unlock,
  X
} from 'lucide-react';

export const CaisseView: React.FC = () => {
  const { user } = useAuth();
  const { t } = useI18n();
  const { showToast } = useToast();

  const [activeSession, setActiveSession] = useState<CashSession | null>(null);
  const [sessionsHistory, setSessionsHistory] = useState<CashSession[]>([]);

  // Modal d'ouverture de caisse
  const [showOpenModal, setShowOpenModal] = useState<boolean>(false);
  const [openingFloatInput, setOpeningFloatInput] = useState<string>('15000');

  // Modal de clôture de caisse & comptage
  const [showCloseModal, setShowCloseModal] = useState<boolean>(false);
  const [denominationCounts, setDenominationCounts] = useState<{ [key: number]: number }>({
    2000: 0,
    1000: 0,
    500: 0,
    200: 0,
    100: 0
  });
  const [closingNotes, setClosingNotes] = useState<string>('');
  const [managerPin, setManagerPin] = useState<string>('');

  // Modal Rapport Z
  const [showZModal, setShowZModal] = useState<boolean>(false);
  const [zReportData, setZReportData] = useState<ZReportSummary | null>(null);

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    const active = await caisseService.getActiveSession();
    setActiveSession(active);
    const hist = await caisseService.getAllSessions(20);
    setSessionsHistory(hist);
  };

  // Calcul du total physique compté
  const totalCounted = Object.entries(denominationCounts).reduce(
    (sum, [denom, count]) => sum + (parseInt(denom, 10) * (count || 0)),
    0
  );

  const expectedDrawer = activeSession ? activeSession.expected_cash_drawer : 0;
  const discrepancy = CurrencyUtil.subtract(totalCounted, expectedDrawer);

  const handleOpenShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const floatAmount = parseFloat(openingFloatInput) || 0;
    try {
      const sess = await caisseService.openShift({
        cashierId: user.id,
        cashierName: user.name,
        openingFloat: floatAmount
      });
      showToast(`Session ouverte avec un fond de ${CurrencyUtil.formatDZD(floatAmount)}`, 'success');
      setShowOpenModal(false);
      await loadSessions();
    } catch (err: any) {
      showToast(`Erreur : ${err.message}`, 'error');
    }
  };

  const handleCloseShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSession) return;

    try {
      const closed = await caisseService.closeShift({
        sessionId: activeSession.id,
        actualCountedCash: totalCounted,
        closingNotes: closingNotes.trim(),
        managerName: user?.name
      });

      const zData = await caisseService.getZReportData(closed.id);
      setZReportData(zData);
      setShowCloseModal(false);
      setShowZModal(true);
      showToast('Session clôturée avec succès. Rapport Z généré.', 'success');
      await loadSessions();
    } catch (err: any) {
      showToast(`Échec clôture : ${err.message}`, 'error');
    }
  };

  const handleViewHistoricalZ = async (sessionId: string) => {
    try {
      const zData = await caisseService.getZReportData(sessionId);
      setZReportData(zData);
      setShowZModal(true);
    } catch (err: any) {
      showToast(`Impossible de charger le rapport : ${err.message}`, 'error');
    }
  };

  return (
    <div className="flex-1 bg-gray-100 p-4 flex flex-col overflow-y-auto space-y-4 text-xs select-none">
      {/* 1. Bandeau Supérieur : État de la Caisse */}
      <div className="bg-white p-3 rounded border border-gray-200 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div
            className={`w-10 h-10 rounded flex items-center justify-center ${
              activeSession ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
            }`}
          >
            <Vault className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-bold text-gray-900 text-sm">
                {activeSession ? 'Caisse Ouverte & En Service' : 'Caisse Fermée'}
              </span>
              <span
                className={`px-1.5 py-0.2 rounded text-[10px] font-mono font-bold ${
                  activeSession ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                }`}
              >
                {activeSession ? 'EN COURS' : 'CLÔTURÉE'}
              </span>
            </div>
            <p className="text-[11px] text-gray-500 mt-0.5">
              {activeSession
                ? `Ouverte par ${activeSession.cashier_name} le ${new Date(activeSession.opened_at).toLocaleString()}`
                : 'Aucune session active. Ouvrez la caisse pour autoriser les encaissements.'}
            </p>
          </div>
        </div>

        <div>
          {activeSession ? (
            <button
              onClick={() => setShowCloseModal(true)}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded bg-red-600 hover:bg-red-700 text-white font-semibold shadow-sm transition-colors"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>{t('caisse.closeSession')}</span>
            </button>
          ) : (
            <button
              onClick={() => setShowOpenModal(true)}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-sm transition-colors"
            >
              <Unlock className="w-3.5 h-3.5" />
              <span>{t('caisse.openSession')}</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Métriques de la Session Active */}
      {activeSession && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
          <div className="bg-white p-2.5 rounded border border-gray-200">
            <span className="text-[11px] text-gray-500 block">Fond Initial</span>
            <span className="text-sm font-bold text-gray-900 font-mono block mt-1">
              {CurrencyUtil.formatDZD(activeSession.opening_float)}
            </span>
          </div>
          <div className="bg-white p-2.5 rounded border border-gray-200">
            <span className="text-[11px] text-gray-500 block">Ventes Espèces</span>
            <span className="text-sm font-bold text-emerald-700 font-mono block mt-1">
              +{CurrencyUtil.formatDZD(activeSession.total_cash_sales)}
            </span>
          </div>
          <div className="bg-white p-2.5 rounded border border-gray-200">
            <span className="text-[11px] text-gray-500 block">Ventes TPE CIB / Edahabia</span>
            <span className="text-sm font-bold text-blue-700 font-mono block mt-1">
              {CurrencyUtil.formatDZD(activeSession.total_card_sales)}
            </span>
          </div>
          <div className="bg-white p-2.5 rounded border border-gray-200">
            <span className="text-[11px] text-gray-500 block">Dépenses Espèces</span>
            <span className="text-sm font-bold text-red-600 font-mono block mt-1">
              -{CurrencyUtil.formatDZD(activeSession.total_cash_expenses)}
            </span>
          </div>
          <div className="bg-white p-2.5 rounded border border-gray-200">
            <span className="text-[11px] text-gray-500 block">Remboursements Espèces</span>
            <span className="text-sm font-bold text-red-600 font-mono block mt-1">
              -{CurrencyUtil.formatDZD(activeSession.total_cash_refunds)}
            </span>
          </div>
          <div className="bg-white p-2.5 rounded border border-gray-200 bg-blue-50/40">
            <span className="text-[11px] font-semibold text-blue-900 block">Tiroir Théorique</span>
            <span className="text-sm font-black text-blue-800 font-mono block mt-1">
              {CurrencyUtil.formatDZD(activeSession.expected_cash_drawer)}
            </span>
          </div>
        </div>
      )}

      {/* 3. Historique des Clôtures de Caisse (Rapports Z) */}
      <div className="bg-white rounded border border-gray-200 overflow-hidden flex flex-col">
        <div className="p-2.5 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
          <div className="flex items-center space-x-1.5">
            <History className="w-3.5 h-3.5 text-gray-500" />
            <span className="font-bold text-gray-900 text-xs">Historique des Sessions & Clôtures Z</span>
          </div>
          <span className="text-[11px] text-gray-500 font-mono">20 dernières sessions</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 text-[11px]">
              <tr>
                <th className="py-2.5 px-3 font-semibold">Date Ouverture</th>
                <th className="py-2.5 px-3 font-semibold">Date Clôture</th>
                <th className="py-2.5 px-3 font-semibold">Caissier</th>
                <th className="py-2.5 px-3 font-semibold text-right">Fond Initial</th>
                <th className="py-2.5 px-3 font-semibold text-right">Ventes Espèces</th>
                <th className="py-2.5 px-3 font-semibold text-right">Espèces Recomptées</th>
                <th className="py-2.5 px-3 font-semibold text-right">Écart</th>
                <th className="py-2.5 px-3 font-semibold text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sessionsHistory.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-6 text-center text-gray-400">
                    Aucune session archivée pour l'instant.
                  </td>
                </tr>
              ) : (
                sessionsHistory.map(s => {
                  const disc = s.cash_discrepancy || 0;
                  return (
                    <tr key={s.id} className="hover:bg-gray-50">
                      <td className="py-2 px-3 font-mono text-gray-600 text-[11px]">
                        {new Date(s.opened_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                      </td>
                      <td className="py-2 px-3 font-mono text-gray-500 text-[11px]">
                        {s.closed_at
                          ? new Date(s.closed_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })
                          : <span className="text-emerald-600 font-bold">En cours</span>}
                      </td>
                      <td className="py-2 px-3 text-gray-800">{s.cashier_name}</td>
                      <td className="py-2 px-3 text-right font-mono text-gray-600">
                        {CurrencyUtil.formatDZD(s.opening_float)}
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-bold text-gray-900">
                        {CurrencyUtil.formatDZD(s.total_cash_sales)}
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-gray-900">
                        {s.actual_counted_cash !== undefined ? CurrencyUtil.formatDZD(s.actual_counted_cash) : '—'}
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-bold">
                        {s.status === 'CLOSED' ? (
                          <span className={disc === 0 ? 'text-emerald-700' : disc > 0 ? 'text-blue-700' : 'text-red-700'}>
                            {disc === 0 ? '0 DA (Juste)' : CurrencyUtil.formatDZD(disc)}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="py-2 px-3 text-center">
                        {s.status === 'CLOSED' && (
                          <button
                            onClick={() => handleViewHistoricalZ(s.id)}
                            className="p-1 hover:bg-gray-100 rounded text-gray-600 hover:text-blue-600"
                            title="Consulter le Rapport Z"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal d'Ouverture de Caisse */}
      {showOpenModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white border border-gray-200 rounded-lg shadow-xl w-full max-w-sm overflow-hidden animate-in fade-in">
            <div className="p-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
              <span className="font-bold text-gray-900 text-sm">Ouverture de Session de Caisse</span>
              <button onClick={() => setShowOpenModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleOpenShift} className="p-4 space-y-3">
              <div>
                <label className="text-[11px] font-semibold text-gray-700 block mb-1">
                  Fond de roulement initial en espèces (DZD) *
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  value={openingFloatInput}
                  onChange={e => setOpeningFloatInput(e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded px-2.5 py-1.5 font-mono text-sm font-bold text-gray-900 focus:outline-none focus:border-blue-600"
                />
              </div>

              {/* Raccourcis fonds de caisse courants */}
              <div className="flex space-x-1">
                {[10000, 15000, 20000, 25000].map(val => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setOpeningFloatInput(val.toString())}
                    className="flex-1 py-1 rounded bg-gray-100 hover:bg-gray-200 border border-gray-200 font-mono text-[10px] text-gray-700"
                  >
                    {val / 1000}k DA
                  </button>
                ))}
              </div>

              <div className="p-3 border-t border-gray-200 bg-gray-50 flex space-x-2 -mx-4 -mb-4 mt-4">
                <button
                  type="button"
                  onClick={() => setShowOpenModal(false)}
                  className="flex-1 py-1.5 rounded bg-white hover:bg-gray-100 border border-gray-300 text-gray-700 font-medium text-xs"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="flex-1 py-1.5 rounded bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-colors"
                >
                  Valider l'Ouverture
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Clôture de Caisse & Comptage des Coupures */}
      {showCloseModal && activeSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white border border-gray-200 rounded-lg shadow-xl w-full max-w-md overflow-hidden animate-in fade-in">
            <div className="p-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
              <span className="font-bold text-gray-900 text-sm">Clôture de Caisse & Comptage Physique</span>
              <button onClick={() => setShowCloseModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCloseShift} className="p-4 space-y-3">
              <div className="p-2 rounded bg-gray-50 border border-gray-200 text-[11px] flex justify-between">
                <span className="text-gray-600">Total Espèces Théorique Attendu :</span>
                <span className="font-bold text-gray-900 font-mono">
                  {CurrencyUtil.formatDZD(activeSession.expected_cash_drawer)}
                </span>
              </div>

              {/* Tableau de comptage des coupures */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-semibold text-gray-700 block">Comptage des billets & pièces :</span>
                {[2000, 1000, 500, 200, 100].map(denom => (
                  <div key={denom} className="flex items-center justify-between space-x-2">
                    <span className="w-20 font-mono text-[11px] text-gray-700">{denom} DA :</span>
                    <input
                      type="number"
                      min="0"
                      value={denominationCounts[denom] || ''}
                      placeholder="0"
                      onChange={e =>
                        setDenominationCounts({
                          ...denominationCounts,
                          [denom]: parseInt(e.target.value, 10) || 0
                        })
                      }
                      className="flex-1 bg-white border border-gray-300 rounded px-2 py-1 font-mono text-xs text-gray-900 focus:outline-none focus:border-blue-600"
                    />
                    <span className="w-24 text-right font-mono text-gray-600 text-[11px]">
                      {CurrencyUtil.formatDZD((denominationCounts[denom] || 0) * denom)}
                    </span>
                  </div>
                ))}
              </div>

              {/* Total Compté & Écart en direct */}
              <div className="p-2.5 rounded border border-gray-200 bg-gray-50 space-y-1">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-gray-900">Total Physique Compté :</span>
                  <span className="font-black text-gray-900 font-mono text-sm">
                    {CurrencyUtil.formatDZD(totalCounted)}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs pt-1 border-t border-gray-200">
                  <span className="font-semibold text-gray-700">Écart de Caisse :</span>
                  <span
                    className={`font-mono font-bold ${
                      discrepancy === 0
                        ? 'text-emerald-700'
                        : discrepancy > 0
                        ? 'text-blue-700'
                        : 'text-red-700'
                    }`}
                  >
                    {discrepancy === 0 ? '0 DA (Parfait)' : CurrencyUtil.formatDZD(discrepancy)}
                  </span>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-gray-700 block mb-1">
                  Observations / Remarques de clôture
                </label>
                <input
                  type="text"
                  placeholder="Ex: RAS ou Billet de 2000 DA déchiré accepté..."
                  value={closingNotes}
                  onChange={e => setClosingNotes(e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded px-2.5 py-1.5 text-xs text-gray-900 focus:outline-none"
                />
              </div>

              <div className="p-3 border-t border-gray-200 bg-gray-50 flex space-x-2 -mx-4 -mb-4 mt-4">
                <button
                  type="button"
                  onClick={() => setShowCloseModal(false)}
                  className="flex-1 py-1.5 rounded bg-white hover:bg-gray-100 border border-gray-300 text-gray-700 font-medium text-xs"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="flex-1 py-1.5 rounded bg-red-600 hover:bg-red-700 text-white font-bold text-xs transition-colors"
                >
                  Confirmer la Clôture Z
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal d'Aperçu & Impression du Rapport Z */}
      {showZModal && zReportData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white border border-gray-200 rounded-lg shadow-xl w-full max-w-sm overflow-hidden animate-in fade-in">
            <div className="p-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
              <span className="font-bold text-gray-900 text-sm">Rapport de Clôture de Caisse (Rapport Z)</span>
              <button onClick={() => setShowZModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3 font-mono text-xs text-gray-800">
              <div className="text-center pb-2 border-b border-gray-200">
                <div className="font-bold text-sm">AQUADRO NUTRITION ALGÉRIE</div>
                <div className="text-[10px] text-gray-500">RAPPORT DE CLÔTURE DE CAISSE (Z)</div>
                <div className="text-[10px] text-gray-400">{new Date(zReportData.generatedAt).toLocaleString()}</div>
              </div>

              <div className="space-y-1 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-gray-500">Caissier :</span>
                  <span className="font-semibold">{zReportData.session.cashier_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Fond Initial :</span>
                  <span>{CurrencyUtil.formatDZD(zReportData.session.opening_float)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Ventes Espèces :</span>
                  <span>{CurrencyUtil.formatDZD(zReportData.paymentBreakdown.cash)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Ventes TPE CIB / Edahabia :</span>
                  <span>{CurrencyUtil.formatDZD(zReportData.paymentBreakdown.cib)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Dépenses Espèces :</span>
                  <span className="text-red-600">-{CurrencyUtil.formatDZD(zReportData.session.total_cash_expenses)}</span>
                </div>
                <div className="flex justify-between pt-1 border-t border-gray-200 font-bold">
                  <span>Espèces Attendues :</span>
                  <span>{CurrencyUtil.formatDZD(zReportData.cashInDrawerExpected)}</span>
                </div>
                <div className="flex justify-between font-bold">
                  <span>Espèces Recomptées :</span>
                  <span>{CurrencyUtil.formatDZD(zReportData.cashInDrawerCounted)}</span>
                </div>
                <div className="flex justify-between pt-1 border-t border-gray-200 font-bold">
                  <span>Écart de Caisse :</span>
                  <span className={zReportData.discrepancy === 0 ? 'text-emerald-700' : 'text-red-700'}>
                    {zReportData.discrepancy === 0 ? '0 DA (Équilibrée)' : CurrencyUtil.formatDZD(zReportData.discrepancy)}
                  </span>
                </div>
              </div>
            </div>

            <div className="p-3 border-t border-gray-200 bg-gray-50 flex space-x-2">
              <button
                type="button"
                onClick={() => setShowZModal(false)}
                className="flex-1 py-1.5 rounded bg-white hover:bg-gray-100 border border-gray-300 text-gray-700 font-medium text-xs"
              >
                Fermer
              </button>
              <button
                type="button"
                onClick={async () => {
                  await printerService.printZReport(zReportData);
                  setShowZModal(false);
                }}
                className="flex-1 py-1.5 rounded bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-colors flex items-center justify-center space-x-1"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Imprimer</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
