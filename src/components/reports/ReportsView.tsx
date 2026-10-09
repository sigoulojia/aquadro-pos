// Aquadro POS Algérie V2 — Rapports Financiers & Rentabilité Commerciale
// Métriques calculées sur données réelles SQLite avec export CSV universel

import React, { useState, useEffect } from 'react';
import { reportService, FinancialMetrics, InventoryValuation } from '../../services/report.service';
import { CurrencyUtil } from '../../core/currency/currency';
import { useToast } from '../common/Toast';
import {
  BarChart3,
  Download,
  Calendar,
  DollarSign,
  TrendingUp,
  CreditCard,
  Layers,
  PackageSearch,
  PenTool,
  PieChart,
  Users,
  Briefcase
} from 'lucide-react';

export const ReportsView: React.FC = () => {
  const { showToast } = useToast();
  const [metrics, setMetrics] = useState<FinancialMetrics | null>(null);
  const [valuation, setValuation] = useState<InventoryValuation | null>(null);
  const [dateFilter, setDateFilter] = useState<string>(new Date().toISOString().split('T')[0]);
  const [notepadText, setNotepadText] = useState<string>(() => localStorage.getItem('apex_pos_notes') || '');

  useEffect(() => {
    localStorage.setItem('apex_pos_notes', notepadText);
  }, [notepadText]);

  useEffect(() => {
    loadReports();
  }, [dateFilter]);

  const loadReports = async () => {
    const m = await reportService.getFinancialMetrics(dateFilter);
    setMetrics(m);
    const val = await reportService.getInventoryValuation();
    setValuation(val);
  };

  const handleExportCsv = () => {
    if (!metrics || !valuation) return;

    const headers = ['Métrique Financière', 'Valeur (DZD)', 'Commentaire'];
    const rows = [
      ['Chiffre d\'Affaires TTC', metrics.revenue, 'Recette globale'],
      ['Coût des Marchandises Vendues (COGS)', metrics.cogs, 'Snapshot coût historique'],
      ['Marge Brute Réalisée', metrics.grossMargin, `${metrics.marginPercentage}% de marge`],
      ['Total des Charges Magasin', metrics.expenses, 'Dépenses enregistrées'],
      ['Résultat Net d\'Exploitation', metrics.netResult, 'Bénéfice net'],
      ['Total Achats Fournisseurs (Jour)', metrics.purchases.totalPurchasesCost, 'Commandes passées aujourd\'hui'],
      ['Créances Clients (Global)', metrics.debts.customerTotalDebt, 'Dettes clients non réglées'],
      ['Dettes Fournisseurs (Global)', metrics.debts.supplierTotalDebt, 'Dettes magasin envers fournisseurs'],
      ['Nombre de Transactions', metrics.transactionCount, 'Tickets de caisse'],
      ['Panier Moyen', metrics.averageBasket, 'Moyenne par client'],
      ['Règlements Espèces', metrics.paymentBreakdown.cash, 'Encaissement tiroir'],
      ['Règlements TPE CIB / Edahabia', metrics.paymentBreakdown.cib_edahabia, 'Télécollecte bancaire'],
      ['Règlements BaridiMob', metrics.paymentBreakdown.baridimob, 'QR Code Algérie Poste'],
      ['Ventes à Crédit Client', metrics.paymentBreakdown.credit, 'Créance enregistrée'],
      ['Actif Stock au Coût d\'Achat', valuation.valuationAtCost, 'Valorisation stock achat'],
      ['Actif Stock au Prix Vente TTC', valuation.valuationAtRetail, 'Valorisation stock vente']
    ];

    reportService.exportToCsv(`aquadro_rapport_financier_${dateFilter}`, headers, rows);
    showToast('Export CSV téléchargé avec succès !', 'success');
  };

  return (
    <div className="h-full w-full bg-gray-100 p-4 overflow-y-auto space-y-4 text-xs select-none pb-20">
      {/* Barre d'outils supérieure */}
      <div className="flex items-center justify-between pb-3">
        <div>
          <h2 className="text-base font-bold text-gray-900">Rapports Financiers & Analyse d'Activité</h2>
          <span className="text-[11px] text-gray-500">
            Rentabilité, coût des marchandises et valorisation des stocks en Dinar Algérien (DZD)
          </span>
        </div>

        <div className="flex items-center space-x-2">
          <input
            type="date"
            value={dateFilter}
            onChange={e => setDateFilter(e.target.value)}
            className="bg-white border border-gray-300 rounded px-2.5 py-1.5 font-mono text-xs text-gray-900 focus:outline-none focus:border-blue-600"
          />

          <button
            onClick={handleExportCsv}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-sm transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Exporter Rapport CSV</span>
          </button>
        </div>
      </div>

      {/* 1. Tableau Synthétique de Rentabilité */}
      <div className="bg-white rounded border border-gray-200 overflow-hidden">
        <div className="p-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <TrendingUp className="w-4 h-4 text-blue-600" />
            <span className="font-bold text-gray-900 text-xs">Compte de Résultat d'Exploitation ({dateFilter})</span>
          </div>
          <span className="text-[11px] text-gray-500">Calcul basé sur l'historique immuable</span>
        </div>

        <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-3 rounded border border-gray-200 bg-gray-50 space-y-1">
            <span className="text-gray-500 text-[11px] block">1. Chiffre d'Affaires Réalisé (TTC)</span>
            <span className="text-lg font-black text-gray-900 font-mono block">
              {metrics ? CurrencyUtil.formatDZD(metrics.revenue) : '—'}
            </span>
            <span className="text-[10px] text-gray-400">{metrics?.transactionCount || 0} tickets de caisse</span>
          </div>

          <div className="p-3 rounded border border-gray-200 bg-gray-50 space-y-1">
            <span className="text-gray-500 text-[11px] block">2. Coût d'Achat des Marchandises (COGS)</span>
            <span className="text-lg font-black text-gray-700 font-mono block">
              {metrics ? CurrencyUtil.formatDZD(metrics.cogs) : '—'}
            </span>
            <span className="text-[10px] text-gray-400">Coût historique au moment de la vente</span>
          </div>

          <div className="p-3 rounded border border-emerald-200 bg-emerald-50/50 space-y-1">
            <span className="text-emerald-800 text-[11px] font-semibold block">3. Marge Brute Commerciale</span>
            <span className="text-lg font-black text-emerald-700 font-mono block">
              {metrics ? CurrencyUtil.formatDZD(metrics.grossMargin) : '—'}
            </span>
            <span className="text-[10px] text-emerald-600 font-bold">
              {metrics ? `${metrics.marginPercentage}% de rentabilité` : '—'}
            </span>
          </div>

          <div className="p-3 rounded border border-blue-200 bg-blue-50/50 space-y-1">
            <span className="text-blue-800 text-[11px] font-semibold block">4. Résultat Net d'Exploitation</span>
            <span className="text-lg font-black text-blue-900 font-mono block">
              {metrics ? CurrencyUtil.formatDZD(metrics.netResult) : '—'}
            </span>
            <span className="text-[10px] text-blue-700">
              Après déduction des charges ({metrics ? CurrencyUtil.formatDZD(metrics.expenses) : '0 DA'})
            </span>
          </div>
        </div>
      </div>

      {/* 2. Ventilation des Règlements & Valorisation du Stock */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Modes de Règlement */}
        <div className="bg-white rounded border border-gray-200 overflow-hidden">
          <div className="p-3 border-b border-gray-200 bg-gray-50 flex items-center space-x-2">
            <PieChart className="w-4 h-4 text-gray-500" />
            <span className="font-bold text-gray-900 text-xs">Ventilation par Mode de Règlement</span>
          </div>

          <div className="p-4 flex flex-col space-y-4">
            {/* Simple CSS Pie Chart representation */}
            <div className="w-full flex h-4 rounded-full overflow-hidden mb-2">
              {metrics && metrics.revenue > 0 ? (
                <>
                  <div className="bg-emerald-500" style={{ width: `${(metrics.paymentBreakdown.cash / metrics.revenue) * 100}%` }} title="Espèces" />
                  <div className="bg-blue-500" style={{ width: `${(metrics.paymentBreakdown.cib_edahabia / metrics.revenue) * 100}%` }} title="CIB" />
                  <div className="bg-purple-500" style={{ width: `${(metrics.paymentBreakdown.baridimob / metrics.revenue) * 100}%` }} title="BaridiMob" />
                  <div className="bg-amber-500" style={{ width: `${(metrics.paymentBreakdown.credit / metrics.revenue) * 100}%` }} title="Crédit" />
                </>
              ) : (
                <div className="bg-gray-200 w-full" />
              )}
            </div>
            
            <div className="space-y-2.5">
              <div className="flex justify-between items-center text-xs pb-1.5 border-b border-gray-100">
                <span className="text-gray-700 font-medium flex items-center"><span className="w-2 h-2 rounded-full bg-emerald-500 mr-2"></span>Espèces (DZD) :</span>
                <span className="font-mono font-bold text-gray-900">
                  {metrics ? CurrencyUtil.formatDZD(metrics.paymentBreakdown.cash) : '0 DA'}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs pb-1.5 border-b border-gray-100">
                <span className="text-gray-700 font-medium flex items-center"><span className="w-2 h-2 rounded-full bg-blue-500 mr-2"></span>CIB / Edahabia :</span>
                <span className="font-mono font-bold text-blue-700">
                  {metrics ? CurrencyUtil.formatDZD(metrics.paymentBreakdown.cib_edahabia) : '0 DA'}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs pb-1.5 border-b border-gray-100">
                <span className="text-gray-700 font-medium flex items-center"><span className="w-2 h-2 rounded-full bg-purple-500 mr-2"></span>BaridiMob :</span>
                <span className="font-mono font-bold text-purple-700">
                  {metrics ? CurrencyUtil.formatDZD(metrics.paymentBreakdown.baridimob) : '0 DA'}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-gray-700 font-medium flex items-center"><span className="w-2 h-2 rounded-full bg-amber-500 mr-2"></span>Crédit Client :</span>
                <span className="font-mono font-bold text-amber-700">
                  {metrics ? CurrencyUtil.formatDZD(metrics.paymentBreakdown.credit) : '0 DA'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Actif Stock Magasin */}
        <div className="bg-white rounded border border-gray-200 overflow-hidden">
          <div className="p-3 border-b border-gray-200 bg-gray-50 flex items-center space-x-2">
            <Layers className="w-4 h-4 text-gray-500" />
            <span className="font-bold text-gray-900 text-xs">Valorisation Globale du Stock en Rayon</span>
          </div>

          <div className="p-4 space-y-2.5">
            <div className="flex justify-between items-center text-xs pb-1.5 border-b border-gray-100">
              <span className="text-gray-700 font-medium">Nombre total de références actives :</span>
              <span className="font-mono font-bold text-gray-900">{valuation?.totalItems || 0} articles</span>
            </div>
            <div className="flex justify-between items-center text-xs pb-1.5 border-b border-gray-100">
              <span className="text-gray-700 font-medium">Volume total en unités physiques :</span>
              <span className="font-mono font-bold text-gray-900">{valuation?.totalUnitsInStock || 0} boîtes/pots</span>
            </div>
            <div className="flex justify-between items-center text-xs pb-1.5 border-b border-gray-100">
              <span className="text-gray-700 font-medium">Actif Stock au Coût d'Achat :</span>
              <span className="font-mono font-bold text-gray-900">
                {valuation ? CurrencyUtil.formatDZD(valuation.valuationAtCost) : '0 DA'}
              </span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-gray-700 font-medium">Valeur Marchande (Prix Vente Public TTC) :</span>
              <span className="font-mono font-black text-emerald-700 text-sm">
                {valuation ? CurrencyUtil.formatDZD(valuation.valuationAtRetail) : '0 DA'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 2.5 Comptes Globaux & Achats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pb-2">
        <div className="bg-white rounded border border-gray-200 overflow-hidden flex flex-col">
          <div className="p-3 border-b border-gray-200 bg-gray-50 flex items-center space-x-2">
            <Briefcase className="w-4 h-4 text-gray-500" />
            <span className="font-bold text-gray-900 text-xs">Achats & Commandes (Jour)</span>
          </div>
          <div className="p-4 flex-1 flex flex-col justify-center items-center">
            <span className="text-[11px] text-gray-500 mb-1">Total des achats enregistrés ce jour</span>
            <span className="text-xl font-black text-gray-900 font-mono">
              {metrics ? CurrencyUtil.formatDZD(metrics.purchases.totalPurchasesCost) : '0 DA'}
            </span>
          </div>
        </div>
        <div className="bg-white rounded border border-gray-200 overflow-hidden flex flex-col">
          <div className="p-3 border-b border-gray-200 bg-amber-50 flex items-center space-x-2">
            <Users className="w-4 h-4 text-amber-600" />
            <span className="font-bold text-amber-900 text-xs">Créances Clients (Dettes)</span>
          </div>
          <div className="p-4 flex-1 flex flex-col justify-center items-center">
            <span className="text-[11px] text-gray-500 mb-1">Total de l'argent dû par les clients</span>
            <span className="text-xl font-black text-amber-700 font-mono">
              {metrics ? CurrencyUtil.formatDZD(metrics.debts.customerTotalDebt) : '0 DA'}
            </span>
          </div>
        </div>
        <div className="bg-white rounded border border-gray-200 overflow-hidden flex flex-col">
          <div className="p-3 border-b border-gray-200 bg-red-50 flex items-center space-x-2">
            <Users className="w-4 h-4 text-red-600" />
            <span className="font-bold text-red-900 text-xs">Dettes Fournisseurs (A payer)</span>
          </div>
          <div className="p-4 flex-1 flex flex-col justify-center items-center">
            <span className="text-[11px] text-gray-500 mb-1">Total de l'argent dû aux fournisseurs</span>
            <span className="text-xl font-black text-red-700 font-mono">
              {metrics ? CurrencyUtil.formatDZD(metrics.debts.supplierTotalDebt) : '0 DA'}
            </span>
          </div>
        </div>
      </div>

      {/* 3. Top Produits & Bloc-notes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pb-10">
        {/* Top Produits Vendus */}
        <div className="bg-white rounded border border-gray-200 overflow-hidden">
          <div className="p-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <BarChart3 className="w-4 h-4 text-gray-500" />
              <span className="font-bold text-gray-900 text-xs">Produits les plus demandés (Top 10)</span>
            </div>
          </div>
          <div className="p-0">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 text-[10px] uppercase text-gray-500 font-bold border-b border-gray-200">
                  <th className="p-3">Produit</th>
                  <th className="p-3 text-center">Qté</th>
                  <th className="p-3 text-right">CA (DZD)</th>
                </tr>
              </thead>
              <tbody>
                {metrics?.topProducts?.length ? (
                  metrics.topProducts.map((p, idx) => (
                    <tr key={p.id} className="border-b border-gray-100 hover:bg-gray-50/50">
                      <td className="p-3 font-medium text-gray-800">{p.name}</td>
                      <td className="p-3 text-center">
                        <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded font-bold">{p.quantity}</span>
                      </td>
                      <td className="p-3 text-right font-mono font-bold">{CurrencyUtil.formatDZD(p.revenue)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} className="p-4 text-center text-gray-400">Aucune vente enregistrée pour cette date.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Bloc-notes / Produits en rupture */}
        <div className="bg-white rounded border border-gray-200 overflow-hidden flex flex-col h-full">
          <div className="p-3 border-b border-gray-200 bg-amber-50 flex items-center space-x-2">
            <PenTool className="w-4 h-4 text-amber-600" />
            <span className="font-bold text-amber-900 text-xs">Bloc-notes & Produits Demandés (Rupture)</span>
          </div>
          <div className="flex-1 p-0">
            <textarea
              className="w-full h-full min-h-[200px] p-4 text-sm text-gray-800 bg-amber-50/30 resize-none focus:outline-none focus:bg-white transition-colors"
              placeholder="Notez ici les produits demandés par les clients, les références à commander, ou toute autre observation de la journée..."
              value={notepadText}
              onChange={(e) => setNotepadText(e.target.value)}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
