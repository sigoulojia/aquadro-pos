// Aquadro POS Algérie V2 — Historique des Ventes & Remboursements Contrôlés
// Table des tickets, réimpression thermique et retours autorisés par code PIN Responsable

import React, { useState, useEffect } from 'react';
import { salesService } from '../../services/sales.service';
import { authService } from '../../services/auth.service';
import { printerService, ReceiptPrintData } from '../../services/printer.service';
import { ReceiptModal } from '../common/ReceiptModal';
import { Sale, SaleItem } from '../../types/database';
import { CurrencyUtil } from '../../core/currency/currency';
import { useToast } from '../common/Toast';
import {
  Receipt,
  Search,
  RotateCcw,
  Printer,
  Eye,
  X,
  ShieldCheck,
  CheckCircle2
} from 'lucide-react';

export const SalesView: React.FC = () => {
  const { showToast } = useToast();
  const [sales, setSales] = useState<Sale[]>([]);
  const [search, setSearch] = useState<string>('');
  const [selectedReceiptData, setSelectedReceiptData] = useState<ReceiptPrintData | null>(null);
  const [showReceiptModal, setShowReceiptModal] = useState<boolean>(false);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [showDetailModal, setShowDetailModal] = useState<boolean>(false);

  // Modal de Remboursement
  const [showRefundModal, setShowRefundModal] = useState<boolean>(false);
  const [refundItems, setRefundItems] = useState<{ [saleItemId: string]: { qty: number; restock: boolean } }>({});
  const [refundReason, setRefundReason] = useState<string>('Échange client ou défaut');
  const [managerPin, setManagerPin] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  useEffect(() => {
    loadSales();
  }, []);

  const loadSales = async () => {
    const list = await salesService.getSales(100);
    setSales(list);
  };

  const filteredSales = sales.filter(s => {
    if (!search.trim()) return true;
    const q = search.toLowerCase().trim();
    return (
      s.receipt_number.toLowerCase().includes(q) ||
      (s.customer_name && s.customer_name.toLowerCase().includes(q)) ||
      (s.cashier_name && s.cashier_name.toLowerCase().includes(q))
    );
  });

  const handleOpenDetail = (sale: Sale) => {
    setSelectedSale(sale);
    setShowDetailModal(true);
  };

  const handleOpenRefund = (sale: Sale) => {
    setSelectedSale(sale);
    const initial: { [key: string]: { qty: number; restock: boolean } } = {};
    sale.items?.forEach(i => {
      initial[i.id] = { qty: i.quantity, restock: true };
    });
    setRefundItems(initial);
    setShowRefundModal(true);
  };

  const handleExecuteRefund = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSale) return;

    const pinCheck = await authService.verifyManagerOrOwnerPin(managerPin);
    if (!pinCheck.valid || !pinCheck.user) {
      showToast('Code PIN Responsable invalide ou non autorisé.', 'error');
      return;
    }

    const itemsToProcess = (selectedSale.items || [])
      .filter(i => refundItems[i.id] && refundItems[i.id].qty > 0)
      .map(i => ({
        saleItemId: i.id,
        productId: i.product_id,
        quantity: refundItems[i.id].qty,
        unitPrice: i.unit_price_ttc,
        unitPurchasePrice: i.unit_purchase_cost_snapshot,
        restock: refundItems[i.id].restock
      }));

    if (itemsToProcess.length === 0) {
      showToast('Veuillez sélectionner au moins un article à rembourser.', 'warning');
      return;
    }

    setIsProcessing(true);
    try {
      const refund = await salesService.processRefund({
        saleId: selectedSale.id,
        cashierId: pinCheck.user.id,
        cashierName: pinCheck.user.name,
        itemsToRefund: itemsToProcess,
        reason: refundReason.trim(),
        managerPin
      });

      showToast(`Avoir ${refund.receipt_number} validé avec succès (${CurrencyUtil.formatDZD(refund.refund_amount)})`, 'success');
      setShowRefundModal(false);
      setManagerPin('');
      await loadSales();
    } catch (err: any) {
      showToast(`Erreur : ${err.message}`, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReprint = async (sale: Sale) => {
    const data: ReceiptPrintData = {
      storeNameFr: 'Aquadro Nutrition Algérie',
      storeNameAr: 'أبكس كور نوتريشن الجزائر',
      storeAddress: 'Dely Ibrahim, Alger',
      storePhone: '0550 12 34 56',
      rcNumber: '16/00-0987654B19',
      nifNumber: '001916012345678',
      fiscalRegime: 'IFU' as const,
      receiptNumber: sale.receipt_number,
      dateTime: new Date(sale.created_at).toLocaleString(),
      cashierName: sale.cashier_name || 'Caissier',
      customerName: sale.customer_name,
      items: (sale.items || []).map(i => ({
        name: i.product_name,
        quantity: i.quantity,
        unitPrice: i.unit_price_ttc,
        total: i.total_ttc
      })),
      subtotalHT: sale.total_ttc,
      taxAmount: 0,
      taxRate: 0,
      totalTTC: sale.total_ttc,
      paymentMethod: sale.payments?.[0]?.payment_method || 'CASH',
      tenderedAmount: sale.total_ttc,
      changeGiven: 0
    };
    setSelectedReceiptData(data);
    setShowReceiptModal(true);
  };

  return (
    <div className="flex-1 bg-gray-100 p-4 flex flex-col overflow-hidden text-xs select-none">
      {/* Barre d'outils supérieure */}
      <div className="flex items-center justify-between pb-3">
        <div>
          <h2 className="text-base font-bold text-gray-900">Historique des Ventes</h2>
          <span className="text-[11px] text-gray-500">
            {sales.length} transactions enregistrées
          </span>
        </div>
      </div>

      {/* Barre de Recherche */}
      <div className="bg-white p-2.5 rounded-t border border-gray-200 border-b-0 flex items-center space-x-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Rechercher par N° ticket, client, caissier..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-gray-50 border border-gray-300 rounded pl-8 pr-3 py-1.5 text-xs text-gray-900 focus:outline-none focus:border-blue-600"
          />
        </div>
      </div>

      {/* Tableau des Ventes */}
      <div className="flex-1 bg-white border border-gray-200 rounded-b overflow-hidden flex flex-col">
        <div className="flex-1 overflow-y-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 text-[11px] sticky top-0">
              <tr>
                <th className="py-2.5 px-3 font-semibold">N° Ticket</th>
                <th className="py-2.5 px-3 font-semibold">Date & Heure</th>
                <th className="py-2.5 px-3 font-semibold">Caissier</th>
                <th className="py-2.5 px-3 font-semibold">Client</th>
                <th className="py-2.5 px-3 font-semibold">Règlement</th>
                <th className="py-2.5 px-3 font-semibold text-right">Total TTC</th>
                <th className="py-2.5 px-3 font-semibold text-center">Statut</th>
                <th className="py-2.5 px-3 font-semibold text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredSales.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-6 text-center text-gray-400">
                    Aucune transaction trouvée.
                  </td>
                </tr>
              ) : (
                filteredSales.map(s => (
                  <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                    <td className="py-2 px-3 font-mono font-bold text-gray-900">{s.receipt_number}</td>
                    <td className="py-2 px-3 font-mono text-gray-500 text-[11px]">
                      {new Date(s.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                    </td>
                    <td className="py-2 px-3 text-gray-700">{s.cashier_name || 'Caissier'}</td>
                    <td className="py-2 px-3 text-gray-700">{s.customer_name || 'Client de passage'}</td>
                    <td className="py-2 px-3">
                      <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-gray-100 text-gray-700 border border-gray-200">
                        {s.payments?.[0]?.payment_method || 'CASH'}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-right font-mono font-bold text-gray-900">
                      {CurrencyUtil.formatDZD(s.total_ttc)}
                    </td>
                    <td className="py-2 px-3 text-center">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          s.status === 'COMPLETED'
                            ? 'bg-emerald-50 text-emerald-800'
                            : s.status === 'REFUNDED'
                            ? 'bg-red-50 text-red-800'
                            : 'bg-amber-50 text-amber-800'
                        }`}
                      >
                        {s.status === 'COMPLETED' ? 'VALIDÉE' : s.status === 'REFUNDED' ? 'REMBOURSÉE' : 'PARTIELLEMENT REMB.'}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-center">
                      <div className="flex items-center justify-center space-x-1">
                        <button
                          onClick={() => handleOpenDetail(s)}
                          className="p-1 hover:bg-gray-100 rounded text-gray-600 hover:text-blue-600"
                          title="Détails de la vente"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleReprint(s)}
                          className="p-1 hover:bg-gray-100 rounded text-gray-600 hover:text-blue-600"
                          title="Réimprimer le ticket"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                        {s.status !== 'REFUNDED' && (
                          <button
                            onClick={() => handleOpenRefund(s)}
                            className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-amber-600"
                            title="Remboursement / Retour"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Détails de Vente */}
      {showDetailModal && selectedSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white border border-gray-200 rounded-lg shadow-xl w-full max-w-md overflow-hidden animate-in fade-in">
            <div className="p-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
              <span className="font-bold text-gray-900 text-sm">
                Détail Vente {selectedSale.receipt_number}
              </span>
              <button onClick={() => setShowDetailModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3">
              <div className="space-y-1 text-xs text-gray-600 border-b border-gray-100 pb-2">
                <div className="flex justify-between">
                  <span>Date :</span>
                  <span className="font-mono text-gray-900">{new Date(selectedSale.created_at).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>Caissier :</span>
                  <span className="text-gray-900 font-medium">{selectedSale.cashier_name}</span>
                </div>
                <div className="flex justify-between">
                  <span>Client :</span>
                  <span className="text-gray-900 font-medium">{selectedSale.customer_name || 'Comptoir'}</span>
                </div>
              </div>

              {/* Lignes d'articles */}
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {selectedSale.items?.map(item => (
                  <div key={item.id} className="flex justify-between items-center text-xs">
                    <div>
                      <div className="font-semibold text-gray-900">{item.product_name}</div>
                      <div className="text-[10px] text-gray-400 font-mono">
                        {item.quantity} x {CurrencyUtil.formatDZD(item.unit_price_ttc)}
                        {item.batch_number ? ` (Lot: ${item.batch_number})` : ''}
                      </div>
                    </div>
                    <span className="font-mono font-bold text-gray-900">
                      {CurrencyUtil.formatDZD(item.total_ttc)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="pt-2 border-t border-gray-200 flex justify-between items-baseline font-bold text-sm">
                <span>Total Net TTC :</span>
                <span className="text-blue-700 font-mono">{CurrencyUtil.formatDZD(selectedSale.total_ttc)}</span>
              </div>
            </div>

            <div className="p-3 border-t border-gray-200 bg-gray-50 flex space-x-2">
              <button
                type="button"
                onClick={() => setShowDetailModal(false)}
                className="flex-1 py-1.5 rounded bg-white hover:bg-gray-100 border border-gray-300 text-gray-700 font-medium text-xs"
              >
                Fermer
              </button>
              <button
                type="button"
                onClick={() => {
                  handleReprint(selectedSale);
                  setShowDetailModal(false);
                }}
                className="flex-1 py-1.5 rounded bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-colors flex items-center justify-center space-x-1"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Réimprimer</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Remboursement avec Code PIN Responsable */}
      {showRefundModal && selectedSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white border border-gray-200 rounded-lg shadow-xl w-full max-w-md overflow-hidden animate-in fade-in">
            <div className="p-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
              <span className="font-bold text-gray-900 text-sm">
                Remboursement Vente {selectedSale.receipt_number}
              </span>
              <button onClick={() => setShowRefundModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleExecuteRefund} className="p-4 space-y-3">
              <span className="text-[11px] font-semibold text-gray-700 block">
                Articles à retourner et réintégrer au stock :
              </span>

              <div className="space-y-2 max-h-44 overflow-y-auto">
                {selectedSale.items?.map(item => {
                  const state = refundItems[item.id] || { qty: item.quantity, restock: true };
                  return (
                    <div key={item.id} className="p-2 rounded border border-gray-200 bg-gray-50 space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="font-semibold text-gray-900 truncate max-w-[200px]">
                          {item.product_name}
                        </span>
                        <span className="font-mono text-gray-600 text-[11px]">
                          Acheté : {item.quantity}
                        </span>
                      </div>
                      <div className="flex items-center justify-between pt-1">
                        <div className="flex items-center space-x-1">
                          <label className="text-[10px] text-gray-500">Qté retour :</label>
                          <input
                            type="number"
                            min="0"
                            max={item.quantity}
                            value={state.qty}
                            onChange={e =>
                              setRefundItems({
                                ...refundItems,
                                [item.id]: { ...state, qty: parseInt(e.target.value, 10) || 0 }
                              })
                            }
                            className="w-12 bg-white border border-gray-300 rounded px-1.5 py-0.5 font-mono text-xs text-center"
                          />
                        </div>
                        <label className="flex items-center space-x-1 text-[11px] text-gray-700 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={state.restock}
                            onChange={e =>
                              setRefundItems({
                                ...refundItems,
                                [item.id]: { ...state, restock: e.target.checked }
                              })
                            }
                            className="rounded border-gray-300 text-blue-600"
                          />
                          <span>Remettre en stock</span>
                        </label>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div>
                <label className="text-[11px] font-semibold text-gray-700 block mb-1">
                  Motif du retour *
                </label>
                <input
                  type="text"
                  required
                  value={refundReason}
                  onChange={e => setRefundReason(e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded px-2.5 py-1.5 text-xs text-gray-900 focus:outline-none"
                />
              </div>

              <div className="pt-2 border-t border-gray-100">
                <label className="text-[11px] font-bold text-gray-900 flex items-center space-x-1 mb-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                  <span>Validation par Code PIN Responsable *</span>
                </label>
                <input
                  type="password"
                  required
                  placeholder="••••"
                  value={managerPin}
                  onChange={e => setManagerPin(e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded px-2.5 py-1.5 font-mono text-sm tracking-widest text-center text-gray-900 focus:outline-none focus:border-blue-600"
                />
              </div>

              <div className="p-3 border-t border-gray-200 bg-gray-50 flex space-x-2 -mx-4 -mb-4 mt-4">
                <button
                  type="button"
                  onClick={() => setShowRefundModal(false)}
                  className="flex-1 py-1.5 rounded bg-white hover:bg-gray-100 border border-gray-300 text-gray-700 font-medium text-xs"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isProcessing}
                  className="flex-1 py-1.5 rounded bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold text-xs transition-colors"
                >
                  {isProcessing ? 'Validation...' : 'Confirmer Remboursement'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL APERÇU ET IMPRESSION DU REÇU SÉLECTIONNÉ                             */}
      {/* ========================================================================= */}
      <ReceiptModal
        isOpen={showReceiptModal}
        onClose={() => setShowReceiptModal(false)}
        receiptData={selectedReceiptData}
      />
    </div>
  );
};
