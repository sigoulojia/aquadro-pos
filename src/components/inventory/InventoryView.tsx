// Aquadro POS Algérie V2 — Gestion des Stocks, Lots FEFO & Traçabilité des Mouvements
// Suivi des dates d'expiration, mouvements auditables et ajustement avec validation PIN Responsable

import React, { useState, useEffect } from 'react';
import { inventoryService } from '../../services/inventory.service';
import { productService } from '../../services/product.service';
import { authService } from '../../services/auth.service';
import { Product, ProductBatch, InventoryMovement, MovementType } from '../../types/database';
import { CurrencyUtil } from '../../core/currency/currency';
import { useToast } from '../common/Toast';
import {
  Layers,
  AlertTriangle,
  History,
  Plus,
  Search,
  CheckCircle2,
  X,
  ShieldCheck,
  ClipboardList
} from 'lucide-react';

export const InventoryView: React.FC = () => {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<'BATCHES' | 'MOVEMENTS' | 'STOCKTAKE'>('BATCHES');
  const [products, setProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [search, setSearch] = useState<string>('');

  // Modal d'ajustement manuel (Perte, Casse, Périmé)
  const [showAdjModal, setShowAdjModal] = useState<boolean>(false);
  const [adjProductId, setAdjProductId] = useState<string>('');
  const [adjType, setAdjType] = useState<MovementType>('DAMAGE');
  const [adjQty, setAdjQty] = useState<number>(1);
  const [adjReason, setAdjReason] = useState<string>('');
  const [managerPin, setManagerPin] = useState<string>('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const prods = await productService.getProducts();
    setProducts(prods);
    const movs = await inventoryService.getRecentMovements(50);
    setMovements(movs);
  };

  const handleApplyAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjProductId) {
      showToast('Veuillez sélectionner un article.', 'warning');
      return;
    }
    if (adjQty <= 0) {
      showToast('La quantité doit être supérieure à zéro.', 'warning');
      return;
    }

    const pinCheck = await authService.verifyManagerOrOwnerPin(managerPin);
    if (!pinCheck.valid || !pinCheck.user) {
      showToast('Code PIN Responsable invalide ou non autorisé.', 'error');
      return;
    }

    try {
      const prod = products.find(p => p.id === adjProductId);
      const isDeduction = adjType === 'DAMAGE' || adjType === 'EXPIRY' || adjType === 'SALE';
      const delta = isDeduction ? -adjQty : adjQty;

      await inventoryService.recordMovement({
        productId: adjProductId,
        movementType: adjType,
        quantityChange: delta,
        reason: `${adjReason.trim()} (Validé par ${pinCheck.user.name})`,
        referenceId: `ADJ-${Date.now().toString().slice(-6)}`,
        unitCostSnapshot: prod?.purchase_cost,
        userId: pinCheck.user.id,
        userName: pinCheck.user.name
      });

      showToast(`Ajustement de stock enregistré (${delta > 0 ? '+' : ''}${delta} unités)`, 'success');
      setShowAdjModal(false);
      setAdjReason('');
      setManagerPin('');
      await loadData();
    } catch (err: any) {
      showToast(`Échec de l'ajustement : ${err.message}`, 'error');
    }
  };

  return (
    <div className="flex-1 bg-gray-100 p-4 flex flex-col overflow-hidden text-xs select-none">
      {/* Barre d'outils supérieure */}
      <div className="flex items-center justify-between pb-3">
        <div>
          <h2 className="text-base font-bold text-gray-900">Stocks, Lots FEFO & Traçabilité</h2>
          <span className="text-[11px] text-gray-500">
            Contrôle sanitaire des dates d'expiration et audit des mouvements
          </span>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowAdjModal(true)}
            className="flex items-center space-x-1 px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-sm transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Ajustement de Stock</span>
          </button>
        </div>
      </div>

      {/* Onglets de Navigation */}
      <div className="bg-white px-3 border border-gray-200 border-b-0 rounded-t flex items-center space-x-4">
        {[
          { id: 'BATCHES', label: 'Surveillance Lots & FEFO', icon: <Layers className="w-3.5 h-3.5" /> },
          { id: 'MOVEMENTS', label: 'Journal des Mouvements (Audit)', icon: <History className="w-3.5 h-3.5" /> }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`py-2.5 flex items-center space-x-1.5 font-medium border-b-2 text-xs transition-colors ${
              activeTab === tab.id
                ? 'border-blue-600 text-blue-700 font-bold'
                : 'border-transparent text-gray-500 hover:text-gray-900'
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Contenu de l'onglet actif */}
      <div className="flex-1 bg-white border border-gray-200 rounded-b overflow-hidden flex flex-col">
        {/* ONGLET 1 : LOTS & FEFO */}
        {activeTab === 'BATCHES' && (
          <div className="flex-1 overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 text-[11px] sticky top-0">
                <tr>
                  <th className="py-2.5 px-3 font-semibold">Article</th>
                  <th className="py-2.5 px-3 font-semibold">N° de Lot</th>
                  <th className="py-2.5 px-3 font-semibold">DLUO / Expiration</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Stock Lot</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Stock Total</th>
                  <th className="py-2.5 px-3 font-semibold text-center">Priorité FEFO / Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {products.map(p => {
                  const batches = p.batches || [];
                  const todayStr = new Date().toISOString().split('T')[0];

                  if (batches.length === 0) {
                    return (
                      <tr key={p.id} className="hover:bg-gray-50">
                        <td className="py-2 px-3 font-semibold text-gray-900">{p.name_fr}</td>
                        <td className="py-2 px-3 text-gray-400 font-mono text-[11px]">Sans lot spécifique</td>
                        <td className="py-2 px-3 text-gray-400 font-mono text-[11px]">—</td>
                        <td className="py-2 px-3 text-right font-mono text-gray-900">{p.current_stock}</td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-gray-900">{p.current_stock}</td>
                        <td className="py-2 px-3 text-center">
                          <span className="px-1.5 py-0.2 rounded text-[10px] bg-gray-100 text-gray-600">
                            STANDARD
                          </span>
                        </td>
                      </tr>
                    );
                  }

                  return batches.map((b, idx) => {
                    const isExpired = b.expiration_date < todayStr;
                    return (
                      <tr key={b.id} className="hover:bg-gray-50">
                        <td className="py-2 px-3 font-semibold text-gray-900">
                          {idx === 0 ? p.name_fr : <span className="text-gray-400 pl-4">↳ Variété lot</span>}
                        </td>
                        <td className="py-2 px-3 font-mono text-gray-700 text-[11px]">{b.batch_number}</td>
                        <td className="py-2 px-3 font-mono font-semibold text-[11px]">
                          <span className={isExpired ? 'text-red-700 font-black' : 'text-gray-900'}>
                            {b.expiration_date}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-gray-900">
                          {b.current_stock}
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-gray-500">
                          {idx === 0 ? p.current_stock : ''}
                        </td>
                        <td className="py-2 px-3 text-center">
                          {isExpired ? (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-800 border border-red-300">
                              PÉRIMÉ (VENTE BLOQUÉE)
                            </span>
                          ) : idx === 0 ? (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                              PRIORITAIRE FEFO
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-gray-100 text-gray-600">
                              LOT SECONDAIRE
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  });
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ONGLET 2 : JOURNAL DES MOUVEMENTS (AUDIT TRAIL) */}
        {activeTab === 'MOVEMENTS' && (
          <div className="flex-1 overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 text-[11px] sticky top-0">
                <tr>
                  <th className="py-2.5 px-3 font-semibold">Date & Heure</th>
                  <th className="py-2.5 px-3 font-semibold">Article</th>
                  <th className="py-2.5 px-3 font-semibold">Type de Mouvement</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Variation</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Nouveau Stock</th>
                  <th className="py-2.5 px-3 font-semibold">Motif / Justificatif</th>
                  <th className="py-2.5 px-3 font-semibold">Opérateur</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {movements.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-6 text-center text-gray-400">
                      Aucun mouvement de stock enregistré.
                    </td>
                  </tr>
                ) : (
                  movements.map(m => (
                    <tr key={m.id} className="hover:bg-gray-50">
                      <td className="py-2 px-3 font-mono text-gray-500 text-[11px]">
                        {new Date(m.created_at).toLocaleString([], {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </td>
                      <td className="py-2 px-3 font-semibold text-gray-900">{m.product_name}</td>
                      <td className="py-2 px-3">
                        <span
                          className={`px-1.5 py-0.2 rounded text-[10px] font-mono font-bold ${
                            m.movement_type === 'SALE'
                              ? 'bg-blue-50 text-blue-700'
                              : m.movement_type === 'PURCHASE'
                              ? 'bg-emerald-50 text-emerald-700'
                              : m.movement_type === 'RETURN'
                              ? 'bg-purple-50 text-purple-700'
                              : 'bg-red-50 text-red-700'
                          }`}
                        >
                          {m.movement_type}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-bold">
                        <span className={m.quantity_change > 0 ? 'text-emerald-700' : 'text-red-700'}>
                          {m.quantity_change > 0 ? `+${m.quantity_change}` : m.quantity_change}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-bold text-gray-900">
                        {m.new_stock}
                      </td>
                      <td className="py-2 px-3 text-gray-600 truncate max-w-xs">{m.reason}</td>
                      <td className="py-2 px-3 text-gray-500">{m.user_name || 'Système'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal d'Ajustement de Stock avec Code PIN Manager */}
      {showAdjModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white border border-gray-200 rounded-lg shadow-xl w-full max-w-md overflow-hidden animate-in fade-in">
            <div className="p-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
              <span className="font-bold text-gray-900 text-sm">Ajustement Manuel de Stock</span>
              <button onClick={() => setShowAdjModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleApplyAdjustment} className="p-4 space-y-3">
              <div>
                <label className="text-[11px] font-semibold text-gray-700 block mb-1">
                  Article concerné *
                </label>
                <select
                  required
                  value={adjProductId}
                  onChange={e => setAdjProductId(e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded px-2.5 py-1.5 text-xs text-gray-900 focus:outline-none focus:border-blue-600"
                >
                  <option value="">Sélectionner un article...</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name_fr} (Stock actuel: {p.current_stock})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-gray-700 block mb-1">
                    Motif de l'opération *
                  </label>
                  <select
                    value={adjType}
                    onChange={e => setAdjType(e.target.value as MovementType)}
                    className="w-full bg-white border border-gray-300 rounded px-2.5 py-1.5 text-xs text-gray-900 focus:outline-none focus:border-blue-600"
                  >
                    <option value="DAMAGE">Casse / Avarié</option>
                    <option value="EXPIRY">Produit Périmé</option>
                    <option value="ADJUSTMENT">Correction d'inventaire (+/-)</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-gray-700 block mb-1">
                    Quantité *
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={adjQty}
                    onChange={e => setAdjQty(parseInt(e.target.value, 10) || 1)}
                    className="w-full bg-white border border-gray-300 rounded px-2.5 py-1.5 font-mono text-xs text-gray-900 focus:outline-none focus:border-blue-600"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-gray-700 block mb-1">
                  Explication détaillée *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Pot tombé en rayon, opercule percé..."
                  value={adjReason}
                  onChange={e => setAdjReason(e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded px-2.5 py-1.5 text-xs text-gray-900 focus:outline-none focus:border-blue-600"
                />
              </div>

              {/* Champ Code PIN Responsable obligatoire */}
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
                <span className="text-[10px] text-gray-400 block mt-1">
                  Autorisation requise pour modifier les stocks hors vente comptoir.
                </span>
              </div>

              <div className="p-3 border-t border-gray-200 bg-gray-50 flex space-x-2 -mx-4 -mb-4 mt-4">
                <button
                  type="button"
                  onClick={() => setShowAdjModal(false)}
                  className="flex-1 py-1.5 rounded bg-white hover:bg-gray-100 border border-gray-300 text-gray-700 font-medium text-xs"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="flex-1 py-1.5 rounded bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-colors"
                >
                  Valider l'Ajustement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
