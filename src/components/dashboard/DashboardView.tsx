// Aquadro POS Algérie V2 — Tableau de Bord Opérationnel Synthétique (Dashboard)
// Design sobre & dense : Métriques d'exploitation réelles, état de caisse et alertes stocks

import React, { useState, useEffect } from 'react';
import { reportService, FinancialMetrics } from '../../services/report.service';
import { inventoryService } from '../../services/inventory.service';
import { salesService } from '../../services/sales.service';
import { caisseService } from '../../services/caisse.service';
import { syncService, SyncStatusResult } from '../../services/sync.service';
import { CurrencyUtil } from '../../core/currency/currency';
import { Sale, Product, CashSession, ProductBatch } from '../../types/database';
import {
  TrendingUp,
  ShoppingCart,
  DollarSign,
  AlertTriangle,
  Calendar,
  Clock,
  ArrowRight,
  CheckCircle2
} from 'lucide-react';

interface DashboardViewProps {
  onNavigateToPOS: () => void;
  onNavigateToInventory: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ onNavigateToPOS, onNavigateToInventory }) => {
  const [metrics, setMetrics] = useState<FinancialMetrics | null>(null);
  const [recentSales, setRecentSales] = useState<Sale[]>([]);
  const [lowStockProducts, setLowStockProducts] = useState<Product[]>([]);
  const [expiringBatches, setExpiringBatches] = useState<Array<ProductBatch & { product_name: string }>>([]);
  const [session, setSession] = useState<CashSession | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatusResult | null>(null);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    const m = await reportService.getFinancialMetrics();
    setMetrics(m);
    const sales = await salesService.getSales(10);
    setRecentSales(sales);
    const low = await inventoryService.getLowStockProducts();
    setLowStockProducts(low);
    const exp = await inventoryService.getExpiringSoonBatches(90);
    setExpiringBatches(exp);
    const sess = await caisseService.getActiveSession();
    setSession(sess);
    const sync = await syncService.getSyncStatus();
    setSyncStatus(sync);
  };

  return (
    <div className="flex-1 bg-gray-100 p-4 overflow-y-auto space-y-4 text-xs select-none">
      {/* 1. Ligne des Indicateurs Clés (KPI Cards Sobre) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
        <div className="bg-white p-2.5 rounded border border-gray-200">
          <span className="text-[11px] text-gray-500 block">Chiffre d'Affaires</span>
          <span className="text-base font-black text-gray-900 font-mono block mt-1">
            {metrics ? CurrencyUtil.formatDZD(metrics.revenue) : '—'}
          </span>
          <span className="text-[10px] text-gray-400">Ventes du jour</span>
        </div>

        <div className="bg-white p-2.5 rounded border border-gray-200">
          <span className="text-[11px] text-gray-500 block">Transactions</span>
          <span className="text-base font-black text-gray-900 font-mono block mt-1">
            {metrics ? metrics.transactionCount : '—'}
          </span>
          <span className="text-[10px] text-gray-400">Tickets émis</span>
        </div>

        <div className="bg-white p-2.5 rounded border border-gray-200">
          <span className="text-[11px] text-gray-500 block">Panier Moyen</span>
          <span className="text-base font-black text-gray-900 font-mono block mt-1">
            {metrics ? CurrencyUtil.formatDZD(metrics.averageBasket) : '—'}
          </span>
          <span className="text-[10px] text-gray-400">Moyenne par client</span>
        </div>

        <div className="bg-white p-2.5 rounded border border-gray-200">
          <span className="text-[11px] text-gray-500 block">Marge Brute Réalisée</span>
          <span className="text-base font-black text-emerald-700 font-mono block mt-1">
            {metrics ? CurrencyUtil.formatDZD(metrics.grossMargin) : '—'}
          </span>
          <span className="text-[10px] text-emerald-600 font-semibold">
            {metrics ? `${metrics.marginPercentage}% de marge` : '—'}
          </span>
        </div>

        <div className="bg-white p-2.5 rounded border border-gray-200">
          <span className="text-[11px] text-gray-500 block">Articles en Rupture</span>
          <span className={`text-base font-black font-mono block mt-1 ${lowStockProducts.length > 0 ? 'text-amber-600' : 'text-gray-900'}`}>
            {lowStockProducts.length}
          </span>
          <span className="text-[10px] text-gray-400">Seuil alerte atteint</span>
        </div>

        <div className="bg-white p-2.5 rounded border border-gray-200">
          <span className="text-[11px] text-gray-500 block">Lots Périment &lt; 90j</span>
          <span className={`text-base font-black font-mono block mt-1 ${expiringBatches.length > 0 ? 'text-red-600' : 'text-gray-900'}`}>
            {expiringBatches.length}
          </span>
          <span className="text-[10px] text-gray-400">Surveillance FEFO</span>
        </div>
      </div>

      {/* 2. État Rapide de Caisse & Synchronisation */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <div className="bg-white p-3 rounded border border-gray-200 flex items-center justify-between">
          <div>
            <div className="flex items-center space-x-1.5">
              <span className={`w-2 h-2 rounded-full ${session ? 'bg-emerald-500' : 'bg-amber-500'}`} />
              <span className="font-bold text-gray-900">
                {session ? `Session Ouverte (${session.cashier_name})` : 'Session de Caisse Fermée'}
              </span>
            </div>
            <p className="text-[11px] text-gray-500 mt-0.5">
              {session
                ? `Espèces théoriques en tiroir : ${CurrencyUtil.formatDZD(session.expected_cash_drawer)}`
                : 'Ouvrez une session de caisse pour débuter les ventes.'}
            </p>
          </div>
          <button
            onClick={onNavigateToPOS}
            className="px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-700 text-white font-semibold flex items-center space-x-1 transition-colors"
          >
            <span>Aller à la Caisse</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="bg-white p-3 rounded border border-gray-200 flex items-center justify-between">
          <div>
            <span className="font-bold text-gray-900">Synchronisation & Résilience Locale</span>
            <p className="text-[11px] text-gray-500 mt-0.5">
              Base SQLite locale autonome. {syncStatus?.pendingCount || 0} opération(s) en attente dans la file Outbox.
            </p>
          </div>
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-100 text-emerald-800">
            OFFLINE READY
          </span>
        </div>
      </div>

      {/* 3. Tableaux d'Exploitation : Ventes Récentes & Alertes Stocks */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Dernières Ventes Réalisées */}
        <div className="bg-white rounded border border-gray-200 overflow-hidden">
          <div className="p-2.5 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
            <span className="font-bold text-gray-900 text-xs">Dernières Ventes Comptoir</span>
            <span className="text-[10px] text-gray-500 font-mono">10 derniers tickets</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 text-[11px]">
                <tr>
                  <th className="py-2 px-3 font-semibold">N° Ticket</th>
                  <th className="py-2 px-3 font-semibold">Heure</th>
                  <th className="py-2 px-3 font-semibold">Caissier</th>
                  <th className="py-2 px-3 font-semibold">Paiement</th>
                  <th className="py-2 px-3 font-semibold text-right">Total TTC</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {recentSales.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-4 text-center text-gray-400">
                      Aucune vente enregistrée pour le moment.
                    </td>
                  </tr>
                ) : (
                  recentSales.map(s => (
                    <tr key={s.id} className="hover:bg-gray-50">
                      <td className="py-2 px-3 font-mono font-semibold text-gray-900">
                        {s.receipt_number}
                      </td>
                      <td className="py-2 px-3 text-gray-500 font-mono text-[11px]">
                        {new Date(s.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="py-2 px-3 text-gray-700">{s.cashier_name || 'Caissier'}</td>
                      <td className="py-2 px-3">
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-gray-100 text-gray-700 border border-gray-200">
                          {s.payments?.[0]?.payment_method || 'CASH'}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-bold text-gray-900">
                        {CurrencyUtil.formatDZD(s.total_ttc)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Alertes Réapprovisionnement & Péremption FEFO */}
        <div className="bg-white rounded border border-gray-200 overflow-hidden">
          <div className="p-2.5 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
            <span className="font-bold text-gray-900 text-xs">Alertes Stocks & Péremptions FEFO</span>
            <button
              onClick={onNavigateToInventory}
              className="text-[11px] text-blue-600 hover:underline font-medium"
            >
              Gérer les stocks
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 text-[11px]">
                <tr>
                  <th className="py-2 px-3 font-semibold">Article</th>
                  <th className="py-2 px-3 font-semibold">DLUO / Lot</th>
                  <th className="py-2 px-3 font-semibold text-right">Stock</th>
                  <th className="py-2 px-3 font-semibold">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {lowStockProducts.length === 0 && expiringBatches.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-4 text-center text-gray-400">
                      Tous les stocks et lots sont en parfait état.
                    </td>
                  </tr>
                ) : (
                  <>
                    {lowStockProducts.slice(0, 5).map(p => (
                      <tr key={p.id} className="hover:bg-gray-50">
                        <td className="py-2 px-3 font-medium text-gray-900 truncate max-w-[160px]">
                          {p.name_fr}
                        </td>
                        <td className="py-2 px-3 text-gray-400 font-mono text-[11px]">
                          {p.barcode}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-amber-600">
                          {p.current_stock}
                        </td>
                        <td className="py-2 px-3">
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            {p.current_stock === 0 ? 'RUPTURE' : 'STOCK FAIBLE'}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {expiringBatches.slice(0, 5).map(b => (
                      <tr key={b.id} className="hover:bg-gray-50">
                        <td className="py-2 px-3 font-medium text-gray-900 truncate max-w-[160px]">
                          {b.product_name}
                        </td>
                        <td className="py-2 px-3 text-red-600 font-mono text-[11px] font-bold">
                          {b.expiration_date}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-gray-900">
                          {b.current_stock}
                        </td>
                        <td className="py-2 px-3">
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-red-50 text-red-700 border border-red-200">
                            EXPIRATION
                          </span>
                        </td>
                      </tr>
                    ))}
                  </>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
