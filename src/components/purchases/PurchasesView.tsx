// Aquadro POS Algérie V2 — Achats & Réceptions Fournisseurs
// Création des bons de commande et réception avec attribution des lots et dates d'expiration FEFO

import React, { useState, useEffect } from 'react';
import { purchaseService, CreatePurchasePayload } from '../../services/purchase.service';
import { supplierService } from '../../services/supplier.service';
import { productService } from '../../services/product.service';
import { Purchase, Supplier, Product } from '../../types/database';
import { CurrencyUtil } from '../../core/currency/currency';
import { useToast } from '../common/Toast';
import {
  Truck,
  Plus,
  CheckCircle,
  PackageCheck,
  Search,
  X,
  FileText
} from 'lucide-react';

export const PurchasesView: React.FC = () => {
  const { showToast } = useToast();
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [showAddModal, setShowAddModal] = useState<boolean>(false);

  // Formulaire d'ajout de commande
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');
  const [orderItems, setOrderItems] = useState<Array<{
    productId: string;
    productName: string;
    quantity: number;
    purchaseCost: number;
    batchNumber: string;
    expirationDate: string;
  }>>([]);

  // Article en cours d'ajout
  const [currentProductId, setCurrentProductId] = useState<string>('');
  const [currentQty, setCurrentQty] = useState<number>(10);
  const [currentCost, setCurrentCost] = useState<number>(5000);
  const [currentBatch, setCurrentBatch] = useState<string>('');
  const [currentExp, setCurrentExp] = useState<string>('2027-12-31');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const list = await purchaseService.getPurchases();
    setPurchases(list);
    const sups = await supplierService.getSuppliers();
    setSuppliers(sups);
    const prods = await productService.getProducts();
    setProducts(prods);
  };

  const handleAddItemToOrder = () => {
    if (!currentProductId) {
      showToast('Sélectionnez un article.', 'warning');
      return;
    }
    const p = products.find(prod => prod.id === currentProductId);
    if (!p) return;

    setOrderItems(prev => [
      ...prev,
      {
        productId: p.id,
        productName: p.name_fr,
        quantity: currentQty,
        purchaseCost: currentCost,
        batchNumber: currentBatch.trim() || `LOT-${Date.now().toString().slice(-4)}`,
        expirationDate: currentExp
      }
    ]);

    setCurrentProductId('');
    setCurrentBatch('');
  };

  const handleCreatePO = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupplierId) {
      showToast('Veuillez sélectionner un fournisseur.', 'warning');
      return;
    }
    if (orderItems.length === 0) {
      showToast('Ajoutez au moins un article à la commande.', 'warning');
      return;
    }

    try {
      const po = await purchaseService.createPurchase({
        supplierId: selectedSupplierId,
        items: orderItems
      });

      showToast(`Bon de commande ${po.order_number} créé avec succès !`, 'success');
      setShowAddModal(false);
      setOrderItems([]);
      await loadData();
    } catch (err: any) {
      showToast(`Erreur : ${err.message}`, 'error');
    }
  };

  const handleReceiveStock = async (purchaseId: string, orderNumber: string) => {
    if (confirm(`Confirmez-vous la réception complète et l'intégration en stock du bon ${orderNumber} ?`)) {
      try {
        await purchaseService.receivePurchase(purchaseId);
        showToast(`Stock intégré et lots créés pour ${orderNumber} !`, 'success');
        await loadData();
      } catch (err: any) {
        showToast(`Échec réception : ${err.message}`, 'error');
      }
    }
  };

  return (
    <div className="flex-1 bg-gray-100 p-4 flex flex-col overflow-hidden text-xs select-none">
      {/* Barre d'outils supérieure */}
      <div className="flex items-center justify-between pb-3">
        <div>
          <h2 className="text-base font-bold text-gray-900">Commandes & Réceptions Fournisseurs</h2>
          <span className="text-[11px] text-gray-500">
            {purchases.length} commandes d'approvisionnement
          </span>
        </div>

        <button
          onClick={() => {
            setSelectedSupplierId(suppliers[0]?.id || '');
            setShowAddModal(true);
          }}
          className="flex items-center space-x-1 px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-sm transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Nouvelle Commande Fournisseur</span>
        </button>
      </div>

      {/* Tableau des Commandes */}
      <div className="flex-1 bg-white border border-gray-200 rounded overflow-hidden flex flex-col">
        <div className="flex-1 overflow-y-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 text-[11px] sticky top-0">
              <tr>
                <th className="py-2.5 px-3 font-semibold">N° Commande</th>
                <th className="py-2.5 px-3 font-semibold">Fournisseur / Distributeur</th>
                <th className="py-2.5 px-3 font-semibold">Date Commande</th>
                <th className="py-2.5 px-3 font-semibold">Date Réception</th>
                <th className="py-2.5 px-3 font-semibold text-right">Coût Total</th>
                <th className="py-2.5 px-3 font-semibold text-center">Statut</th>
                <th className="py-2.5 px-3 font-semibold text-center">Action Réception</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {purchases.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-gray-400">
                    Aucune commande d'achat enregistrée.
                  </td>
                </tr>
              ) : (
                purchases.map(p => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="py-2 px-3 font-mono font-bold text-gray-900">{p.order_number}</td>
                    <td className="py-2 px-3 text-gray-800 font-medium">{p.supplier_name}</td>
                    <td className="py-2 px-3 font-mono text-gray-500 text-[11px]">
                      {new Date(p.ordered_at).toLocaleDateString()}
                    </td>
                    <td className="py-2 px-3 font-mono text-gray-500 text-[11px]">
                      {p.received_at ? new Date(p.received_at).toLocaleDateString() : '—'}
                    </td>
                    <td className="py-2 px-3 text-right font-mono font-bold text-gray-900">
                      {CurrencyUtil.formatDZD(p.total_cost)}
                    </td>
                    <td className="py-2 px-3 text-center">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          p.status === 'RECEIVED'
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            : 'bg-amber-50 text-amber-800 border border-amber-200'
                        }`}
                      >
                        {p.status === 'RECEIVED' ? 'RÉCEPTIONNÉE' : 'EN COMMANDE'}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-center">
                      {p.status === 'ORDERED' ? (
                        <button
                          onClick={() => handleReceiveStock(p.id, p.order_number)}
                          className="px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-[11px] flex items-center justify-center space-x-1 mx-auto"
                        >
                          <PackageCheck className="w-3 h-3" />
                          <span>Réceptionner Stock</span>
                        </button>
                      ) : (
                        <span className="text-gray-400 text-[11px] flex items-center justify-center space-x-1">
                          <CheckCircle className="w-3 h-3 text-emerald-600" />
                          <span>En rayon</span>
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Création Commande Fournisseur */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white border border-gray-200 rounded-lg shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in">
            <div className="p-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
              <span className="font-bold text-gray-900 text-sm">Nouvelle Commande d'Approvisionnement</span>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreatePO} className="p-4 space-y-3">
              <div>
                <label className="text-[11px] font-semibold text-gray-700 block mb-1">
                  Distributeur / Fournisseur *
                </label>
                <select
                  required
                  value={selectedSupplierId}
                  onChange={e => setSelectedSupplierId(e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded px-2.5 py-1.5 text-xs text-gray-900 focus:outline-none focus:border-blue-600"
                >
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.contact_person || 'Importateur'})
                    </option>
                  ))}
                </select>
              </div>

              {/* Ajout d'articles à la commande */}
              <div className="p-2.5 rounded border border-gray-200 bg-gray-50 space-y-2">
                <span className="text-[11px] font-bold text-gray-800 block">Ajouter des articles :</span>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-gray-500 block">Article</label>
                    <select
                      value={currentProductId}
                      onChange={e => {
                        setCurrentProductId(e.target.value);
                        const sel = products.find(p => p.id === e.target.value);
                        if (sel) setCurrentCost(sel.purchase_cost);
                      }}
                      className="w-full bg-white border border-gray-300 rounded px-2 py-1 text-xs"
                    >
                      <option value="">Sélectionner un produit...</option>
                      {products.map(p => (
                        <option key={p.id} value={p.id}>{p.name_fr}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500 block">Quantité</label>
                    <input
                      type="number"
                      min="1"
                      value={currentQty}
                      onChange={e => setCurrentQty(parseInt(e.target.value, 10) || 1)}
                      className="w-full bg-white border border-gray-300 rounded px-2 py-1 text-xs font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[10px] text-gray-500 block">Coût Achat (DA)</label>
                    <input
                      type="number"
                      value={currentCost}
                      onChange={e => setCurrentCost(parseFloat(e.target.value) || 0)}
                      className="w-full bg-white border border-gray-300 rounded px-2 py-1 text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500 block">N° de Lot prévu</label>
                    <input
                      type="text"
                      placeholder="Ex: LOT-2026-X"
                      value={currentBatch}
                      onChange={e => setCurrentBatch(e.target.value)}
                      className="w-full bg-white border border-gray-300 rounded px-2 py-1 text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500 block">Date Péremption</label>
                    <input
                      type="date"
                      value={currentExp}
                      onChange={e => setCurrentExp(e.target.value)}
                      className="w-full bg-white border border-gray-300 rounded px-2 py-1 text-xs font-mono"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleAddItemToOrder}
                  className="w-full py-1.5 rounded bg-gray-200 hover:bg-gray-300 font-semibold text-gray-800 text-xs"
                >
                  + Ajouter à la liste
                </button>
              </div>

              {/* Lignes ajoutées */}
              <div className="space-y-1 max-h-36 overflow-y-auto">
                {orderItems.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center p-1.5 rounded bg-white border border-gray-200 text-[11px]">
                    <div>
                      <div className="font-semibold text-gray-900">{item.productName}</div>
                      <div className="text-[10px] text-gray-400 font-mono">
                        {item.quantity} x {CurrencyUtil.formatDZD(item.purchaseCost)} (DLUO: {item.expirationDate})
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setOrderItems(orderItems.filter((_, i) => i !== idx))}
                      className="text-red-500 hover:text-red-700 p-1"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="p-3 border-t border-gray-200 bg-gray-50 flex space-x-2 -mx-4 -mb-4 mt-4">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-1.5 rounded bg-white hover:bg-gray-100 border border-gray-300 text-gray-700 font-medium text-xs"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={orderItems.length === 0}
                  className="flex-1 py-1.5 rounded bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs transition-colors"
                >
                  Valider Bon de Commande
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
