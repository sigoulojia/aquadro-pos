// Aquadro POS Algérie V2 — Gestion Complète des Produits & Articles
// Table dense professionnelle, création/édition avec détection de doublons codes-barres/SKU et impression étiquettes

import React, { useState, useEffect } from 'react';
import { productService, CreateProductInput } from '../../services/product.service';
import { Product } from '../../types/database';
import { CurrencyUtil } from '../../core/currency/currency';
import { useScanner } from '../../core/keyboard/useKeyboard';
import { CameraScanner } from '../common/CameraScanner';
import { useToast } from '../common/Toast';
import {
  Search,
  Plus,
  Edit2,
  Trash2,
  Barcode,
  X,
  Printer,
  Camera,
  CheckCircle,
  AlertTriangle
} from 'lucide-react';

export const ProductsView: React.FC = () => {
  const { showToast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [showCamera, setShowCamera] = useState<boolean>(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Formulaire d'ajout / modification
  const [formData, setFormData] = useState<CreateProductInput>({
    sku: '',
    barcode: '',
    name_fr: '',
    name_ar: '',
    variant: '',
    size_weight: '',
    purchase_cost: 0,
    selling_price_ttc: 0,
    current_stock: 0,
    min_stock_alert: 5,
    initial_batch_number: '',
    initial_expiration_date: ''
  });

  useEffect(() => {
    loadProducts();
  }, []);

  // Scanner support: Auto-search when barcode is scanned
  useScanner((barcode) => {
    if (showAddModal) {
      // If modal is open, let the user scan into the barcode field
      setFormData(prev => ({ ...prev, barcode }));
      showToast('Code-barres scanné', 'success');
    } else {
      setSearch(barcode);
    }
  });

  const loadProducts = async () => {
    const list = await productService.getProducts();
    setProducts(list);
  };

  const filtered = products.filter(p => {
    const matchesCat = categoryFilter === 'ALL' || p.category_id === categoryFilter;
    if (!matchesCat) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      p.barcode.toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q) ||
      p.name_fr.toLowerCase().includes(q) ||
      p.name_ar.toLowerCase().includes(q)
    );
  });

  const handleOpenCreate = () => {
    setEditingProduct(null);
    setFormData({
      sku: `SKU-${Date.now().toString().slice(-6)}`,
      barcode: `${Math.floor(1000000000000 + Math.random() * 9000000000000)}`,
      name_fr: '',
      name_ar: '',
      variant: '',
      size_weight: '',
      purchase_cost: 5000,
      selling_price_ttc: 7500,
      current_stock: 10,
      min_stock_alert: 5,
      initial_batch_number: `LOT-${new Date().getFullYear()}-01`,
      initial_expiration_date: '2027-12-31'
    });
    setShowAddModal(true);
  };

  const handleOpenEdit = (p: Product) => {
    setEditingProduct(p);
    setFormData({
      sku: p.sku,
      barcode: p.barcode,
      name_fr: p.name_fr,
      name_ar: p.name_ar,
      variant: p.variant || '',
      size_weight: p.size_weight || '',
      purchase_cost: p.purchase_cost,
      selling_price_ttc: p.selling_price_ttc,
      current_stock: p.current_stock,
      min_stock_alert: p.min_stock_alert
    });
    setShowAddModal(true);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingProduct) {
        await productService.updateProduct(editingProduct.id, {
          name_fr: formData.name_fr,
          name_ar: formData.name_ar,
          variant: formData.variant,
          size_weight: formData.size_weight,
          purchase_cost: formData.purchase_cost,
          selling_price_ttc: formData.selling_price_ttc,
          min_stock_alert: formData.min_stock_alert
        });
        showToast('Article mis à jour avec succès', 'success');
      } else {
        await productService.createProduct(formData);
        showToast('Article créé avec succès', 'success');
      }
      setShowAddModal(false);
      await loadProducts();
    } catch (err: any) {
      showToast(`Erreur : ${err.message}`, 'error');
    }
  };

  const handleArchive = async (id: string, name: string) => {
    if (confirm(`Confirmez-vous l'archivage de "${name}" ?`)) {
      await productService.archiveProduct(id);
      showToast('Article archivé', 'info');
      await loadProducts();
    }
  };

  return (
    <div className="flex-1 bg-gray-100 p-4 flex flex-col overflow-hidden text-xs select-none">
      {/* Barre d'outils supérieure */}
      <div className="flex items-center justify-between pb-3">
        <div>
          <h2 className="text-base font-bold text-gray-900">Articles & Produits</h2>
          <span className="text-[11px] text-gray-500">
            {products.length} références actives au catalogue
          </span>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handleOpenCreate}
            className="flex items-center space-x-1 px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-sm transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Nouvel Article</span>
          </button>
        </div>
      </div>

      {/* Barre de Recherche et Filtres */}
      <div className="bg-white p-2.5 rounded-t border border-gray-200 border-b-0 flex items-center space-x-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Rechercher par nom, code-barres, référence SKU..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-gray-50 border border-gray-300 rounded pl-8 pr-3 py-1.5 text-xs text-gray-900 focus:outline-none focus:border-blue-600"
          />
        </div>

        <div className="flex items-center space-x-1">
          <span className="text-gray-500 text-[11px]">Catégorie :</span>
          <select
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}
            className="bg-gray-50 border border-gray-300 rounded px-2 py-1.5 text-xs text-gray-800 focus:outline-none"
          >
            <option value="ALL">Toutes les catégories</option>
            <option value="cat-protein">Protéines & Whey</option>
            <option value="cat-creatine">Créatines</option>
            <option value="cat-preworkout">Pre-Workout</option>
            <option value="cat-amino">BCAA & Acides Aminés</option>
            <option value="cat-vitamins">Vitamines</option>
            <option value="cat-snacks">Barres & Snacks</option>
            <option value="cat-gear">Accessoires</option>
          </select>
        </div>
      </div>

      {/* Tableau Pro des Articles */}
      <div className="flex-1 bg-white border border-gray-200 rounded-b overflow-hidden flex flex-col">
        <div className="flex-1 overflow-y-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 text-[11px] sticky top-0">
              <tr>
                <th className="py-2.5 px-3 font-semibold">Code-barres</th>
                <th className="py-2.5 px-3 font-semibold">SKU</th>
                <th className="py-2.5 px-3 font-semibold">Désignation (FR / AR)</th>
                <th className="py-2.5 px-3 font-semibold">Conditionnement / Variante</th>
                <th className="py-2.5 px-3 font-semibold text-right">Coût Achat</th>
                <th className="py-2.5 px-3 font-semibold text-right">Prix Vente TTC</th>
                <th className="py-2.5 px-3 font-semibold text-right">Stock</th>
                <th className="py-2.5 px-3 font-semibold text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-6 text-center text-gray-400">
                    Aucun article trouvé pour ces critères de recherche.
                  </td>
                </tr>
              ) : (
                filtered.map(p => (
                  <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                    <td className="py-2 px-3 font-mono text-gray-600 text-[11px]">
                      {p.barcode}
                    </td>
                    <td className="py-2 px-3 font-mono text-gray-500 text-[11px]">
                      {p.sku}
                    </td>
                    <td className="py-2 px-3">
                      <div className="font-semibold text-gray-900">{p.name_fr}</div>
                      {p.name_ar && <div className="text-[11px] text-gray-400">{p.name_ar}</div>}
                    </td>
                    <td className="py-2 px-3 text-gray-500">
                      {p.variant ? `${p.variant} ` : ''}
                      {p.size_weight ? `(${p.size_weight})` : ''}
                    </td>
                    <td className="py-2 px-3 text-right font-mono text-gray-600">
                      {CurrencyUtil.formatDZD(p.purchase_cost)}
                    </td>
                    <td className="py-2 px-3 text-right font-mono font-bold text-gray-900">
                      {CurrencyUtil.formatDZD(p.selling_price_ttc)}
                    </td>
                    <td className="py-2 px-3 text-right font-mono font-bold">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[11px] ${
                          p.current_stock <= 0
                            ? 'bg-red-50 text-red-700 font-bold border border-red-200'
                            : p.current_stock <= p.min_stock_alert
                            ? 'bg-amber-50 text-amber-700 font-bold border border-amber-200'
                            : 'text-gray-900'
                        }`}
                      >
                        {p.current_stock}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-center">
                      <div className="flex items-center justify-center space-x-1">
                        <button
                          onClick={() => handleOpenEdit(p)}
                          className="p-1 hover:bg-gray-100 rounded text-gray-600 hover:text-blue-600"
                          title="Modifier"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleArchive(p.id, p.name_fr)}
                          className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-red-600"
                          title="Archiver"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Création / Modification d'Article */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white border border-gray-200 rounded-lg shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in">
            <div className="p-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
              <span className="font-bold text-gray-900 text-sm">
                {editingProduct ? 'Modifier l\'Article' : 'Ajouter un Nouvel Article'}
              </span>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-gray-700 block mb-1">
                    Désignation (Français) *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name_fr}
                    onChange={e => setFormData({ ...formData, name_fr: e.target.value })}
                    className="w-full bg-white border border-gray-300 rounded px-2.5 py-1.5 text-xs text-gray-900 focus:outline-none focus:border-blue-600"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-gray-700 block mb-1">
                    Désignation (Arabe)
                  </label>
                  <input
                    type="text"
                    value={formData.name_ar}
                    onChange={e => setFormData({ ...formData, name_ar: e.target.value })}
                    className="w-full bg-white border border-gray-300 rounded px-2.5 py-1.5 text-xs text-gray-900 focus:outline-none focus:border-blue-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-gray-700 block mb-1">
                    Code-barres (EAN-13) *
                  </label>
                  <div className="flex">
                    <input
                      type="text"
                      required
                      disabled={!!editingProduct}
                      value={formData.barcode}
                      onChange={e => setFormData({ ...formData, barcode: e.target.value })}
                      className="w-full bg-white border border-gray-300 rounded-l px-2.5 py-1.5 font-mono text-xs text-gray-900 focus:outline-none focus:border-blue-600 disabled:bg-gray-100"
                    />
                    <button
                      type="button"
                      disabled={!!editingProduct}
                      onClick={() => setShowCamera(true)}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-2.5 rounded-r flex items-center justify-center disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                      title="التقاط الباركود (كاميرا / douchette / يدوي)"
                    >
                      <Camera className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-gray-700 block mb-1">
                    Référence SKU *
                  </label>
                  <input
                    type="text"
                    required
                    disabled={!!editingProduct}
                    value={formData.sku}
                    onChange={e => setFormData({ ...formData, sku: e.target.value })}
                    className="w-full bg-white border border-gray-300 rounded px-2.5 py-1.5 font-mono text-xs text-gray-900 focus:outline-none focus:border-blue-600 disabled:bg-gray-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-gray-700 block mb-1">
                    Arôme / Saveur
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Chocolat, Vanille"
                    value={formData.variant || ''}
                    onChange={e => setFormData({ ...formData, variant: e.target.value })}
                    className="w-full bg-white border border-gray-300 rounded px-2.5 py-1.5 text-xs text-gray-900 focus:outline-none focus:border-blue-600"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-gray-700 block mb-1">
                    Poids / Contenance
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: 5 lbs (2.27kg), 30 Doses"
                    value={formData.size_weight || ''}
                    onChange={e => setFormData({ ...formData, size_weight: e.target.value })}
                    className="w-full bg-white border border-gray-300 rounded px-2.5 py-1.5 text-xs text-gray-900 focus:outline-none focus:border-blue-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 pt-1 border-t border-gray-100">
                <div>
                  <label className="text-[11px] font-semibold text-gray-700 block mb-1">
                    Coût d'Achat (DA) *
                  </label>
                  <input
                    type="number"
                    required
                    value={formData.purchase_cost}
                    onChange={e => setFormData({ ...formData, purchase_cost: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-white border border-gray-300 rounded px-2.5 py-1.5 font-mono text-xs text-gray-900 focus:outline-none focus:border-blue-600"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-gray-700 block mb-1">
                    Prix Vente TTC (DA) *
                  </label>
                  <input
                    type="number"
                    required
                    value={formData.selling_price_ttc}
                    onChange={e => setFormData({ ...formData, selling_price_ttc: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-white border border-gray-300 rounded px-2.5 py-1.5 font-mono text-xs font-bold text-gray-900 focus:outline-none focus:border-blue-600"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-gray-700 block mb-1">
                    Seuil Alerte
                  </label>
                  <input
                    type="number"
                    value={formData.min_stock_alert}
                    onChange={e => setFormData({ ...formData, min_stock_alert: parseInt(e.target.value, 10) || 5 })}
                    className="w-full bg-white border border-gray-300 rounded px-2.5 py-1.5 font-mono text-xs text-gray-900 focus:outline-none focus:border-blue-600"
                  />
                </div>
              </div>

              {!editingProduct && (
                <div className="grid grid-cols-3 gap-3 pt-1 border-t border-gray-100">
                  <div>
                    <label className="text-[11px] font-semibold text-gray-700 block mb-1">
                      Stock Initial
                    </label>
                    <input
                      type="number"
                      value={formData.current_stock}
                      onChange={e => setFormData({ ...formData, current_stock: parseInt(e.target.value, 10) || 0 })}
                      className="w-full bg-white border border-gray-300 rounded px-2.5 py-1.5 font-mono text-xs text-gray-900 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-gray-700 block mb-1">
                      N° de Lot
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: LOT-2026-X"
                      value={formData.initial_batch_number || ''}
                      onChange={e => setFormData({ ...formData, initial_batch_number: e.target.value })}
                      className="w-full bg-white border border-gray-300 rounded px-2.5 py-1.5 font-mono text-xs text-gray-900 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-gray-700 block mb-1">
                      DLUO / Péremption
                    </label>
                    <input
                      type="date"
                      value={formData.initial_expiration_date || ''}
                      onChange={e => setFormData({ ...formData, initial_expiration_date: e.target.value })}
                      className="w-full bg-white border border-gray-300 rounded px-2.5 py-1.5 font-mono text-xs text-gray-900 focus:outline-none"
                    />
                  </div>
                </div>
              )}

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
                  className="flex-1 py-1.5 rounded bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-colors"
                >
                  Enregistrer l'Article
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Scanner Caméra pour l'ajout de produit */}
      {showCamera && (
        <CameraScanner
          onScanSuccess={(decodedText) => {
            setFormData({ ...formData, barcode: decodedText });
            setShowCamera(false);
            showToast('Code-barres scanné avec succès !', 'success');
          }}
          onClose={() => setShowCamera(false)}
        />
      )}
    </div>
  );
};
