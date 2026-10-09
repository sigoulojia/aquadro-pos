// Aquadro POS Algérie V2 — Gestion des Fournisseurs & Règlements Distributeurs
// Suivi des importateurs officiels de suppléments et des dettes fournisseurs en Algérie

import React, { useState, useEffect } from 'react';
import { supplierService } from '../../services/supplier.service';
import { Supplier } from '../../types/database';
import { CurrencyUtil } from '../../core/currency/currency';
import { useToast } from '../common/Toast';
import { useAuth } from '../../hooks/useAuth';
import {
  Building2,
  Plus,
  Search,
  Phone,
  Mail,
  Edit2,
  Banknote,
  X
} from 'lucide-react';

export const SuppliersView: React.FC = () => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [search, setSearch] = useState<string>('');

  // Modal Création / Modification
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    contact_person: '',
    phone: '',
    email: '',
    rc_number: '',
    nif_number: ''
  });

  // Modal Règlement Fournisseur
  const [showPayModal, setShowPayModal] = useState<boolean>(false);
  const [targetSupplier, setTargetSupplier] = useState<Supplier | null>(null);
  const [payAmount, setPayAmount] = useState<string>('');
  const [payMethod, setPayMethod] = useState<'CASH' | 'CHECK' | 'TRANSFER'>('TRANSFER');
  const [payRef, setPayRef] = useState<string>('');

  useEffect(() => {
    loadSuppliers();
  }, []);

  const loadSuppliers = async () => {
    const list = await supplierService.getSuppliers();
    setSuppliers(list);
  };

  const filtered = suppliers.filter(s => {
    if (!search.trim()) return true;
    const q = search.toLowerCase().trim();
    return (
      s.name.toLowerCase().includes(q) ||
      (s.contact_person && s.contact_person.toLowerCase().includes(q)) ||
      (s.phone && s.phone.includes(q))
    );
  });

  const handleOpenCreate = () => {
    setEditingSupplier(null);
    setFormData({
      name: '',
      contact_person: '',
      phone: '023 20 40 50',
      email: '',
      rc_number: '16/00-1234567B22',
      nif_number: '001516012345678'
    });
    setShowAddModal(true);
  };

  const handleSaveSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingSupplier) {
        await supplierService.updateSupplier(editingSupplier.id, formData);
        showToast('Fournisseur mis à jour', 'success');
      } else {
        await supplierService.createSupplier(formData);
        showToast('Fournisseur enregistré avec succès', 'success');
      }
      setShowAddModal(false);
      await loadSuppliers();
    } catch (err: any) {
      showToast(`Erreur : ${err.message}`, 'error');
    }
  };

  const handleOpenPay = (s: Supplier) => {
    setTargetSupplier(s);
    setPayAmount(s.current_balance.toString());
    setPayRef(`VIR-${Date.now().toString().slice(-6)}`);
    setShowPayModal(true);
  };

  const handleConfirmPay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetSupplier || !user) return;
    const amount = parseFloat(payAmount) || 0;
    try {
      await supplierService.recordSupplierPayment({
        supplierId: targetSupplier.id,
        amount,
        paymentMethod: payMethod,
        reference: payRef.trim(),
        cashierId: user.id
      });
      showToast(`Règlement de ${CurrencyUtil.formatDZD(amount)} enregistré pour ${targetSupplier.name}`, 'success');
      setShowPayModal(false);
      await loadSuppliers();
    } catch (err: any) {
      showToast(`Erreur : ${err.message}`, 'error');
    }
  };

  return (
    <div className="flex-1 bg-gray-100 p-4 flex flex-col overflow-hidden text-xs select-none">
      {/* Barre d'outils supérieure */}
      <div className="flex items-center justify-between pb-3">
        <div>
          <h2 className="text-base font-bold text-gray-900">Fournisseurs & Distributeurs</h2>
          <span className="text-[11px] text-gray-500">
            {suppliers.length} grossistes et importateurs enregistrés
          </span>
        </div>

        <button
          onClick={handleOpenCreate}
          className="flex items-center space-x-1 px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-sm transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Nouveau Fournisseur</span>
        </button>
      </div>

      {/* Barre de Recherche */}
      <div className="bg-white p-2.5 rounded-t border border-gray-200 border-b-0 flex items-center space-x-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Rechercher par société, commercial, téléphone..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-gray-50 border border-gray-300 rounded pl-8 pr-3 py-1.5 text-xs text-gray-900 focus:outline-none focus:border-blue-600"
          />
        </div>
      </div>

      {/* Tableau des Fournisseurs */}
      <div className="flex-1 bg-white border border-gray-200 rounded-b overflow-hidden flex flex-col">
        <div className="flex-1 overflow-y-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 text-[11px] sticky top-0">
              <tr>
                <th className="py-2.5 px-3 font-semibold">Société / Distributeur</th>
                <th className="py-2.5 px-3 font-semibold">Représentant Commercial</th>
                <th className="py-2.5 px-3 font-semibold">Téléphone</th>
                <th className="py-2.5 px-3 font-semibold">NIF / RC</th>
                <th className="py-2.5 px-3 font-semibold text-right">Solde Dû (Dette)</th>
                <th className="py-2.5 px-3 font-semibold text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-gray-400">
                    Aucun fournisseur trouvé.
                  </td>
                </tr>
              ) : (
                filtered.map(s => (
                  <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                    <td className="py-2 px-3 font-semibold text-gray-900">{s.name}</td>
                    <td className="py-2 px-3 text-gray-700">{s.contact_person || '—'}</td>
                    <td className="py-2 px-3 font-mono text-gray-600">{s.phone || '—'}</td>
                    <td className="py-2 px-3 font-mono text-gray-500 text-[11px]">
                      {s.nif_number ? `NIF: ${s.nif_number}` : '—'}
                    </td>
                    <td className="py-2 px-3 text-right font-mono font-bold">
                      <span className={s.current_balance > 0 ? 'text-red-700' : 'text-gray-700'}>
                        {CurrencyUtil.formatDZD(s.current_balance)}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-center">
                      <div className="flex items-center justify-center space-x-1">
                        {s.current_balance > 0 && (
                          <button
                            onClick={() => handleOpenPay(s)}
                            className="px-2 py-0.5 rounded bg-blue-50 hover:bg-blue-100 border border-blue-300 text-blue-800 font-semibold text-[11px]"
                            title="Régler le fournisseur"
                          >
                            Payer Dette
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setEditingSupplier(s);
                            setFormData({
                              name: s.name,
                              contact_person: s.contact_person || '',
                              phone: s.phone || '',
                              email: s.email || '',
                              rc_number: s.rc_number || '',
                              nif_number: s.nif_number || ''
                            });
                            setShowAddModal(true);
                          }}
                          className="p-1 hover:bg-gray-100 rounded text-gray-600 hover:text-blue-600"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
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

      {/* Modal Création / Modification Fournisseur */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white border border-gray-200 rounded-lg shadow-xl w-full max-w-md overflow-hidden animate-in fade-in">
            <div className="p-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
              <span className="font-bold text-gray-900 text-sm">
                {editingSupplier ? 'Modifier Fournisseur' : 'Nouveau Fournisseur'}
              </span>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveSupplier} className="p-4 space-y-3">
              <div>
                <label className="text-[11px] font-semibold text-gray-700 block mb-1">
                  Raison Sociale / Nom de l'Entreprise *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-white border border-gray-300 rounded px-2.5 py-1.5 text-xs text-gray-900 focus:outline-none focus:border-blue-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-gray-700 block mb-1">
                    Contact Commercial
                  </label>
                  <input
                    type="text"
                    value={formData.contact_person}
                    onChange={e => setFormData({ ...formData, contact_person: e.target.value })}
                    className="w-full bg-white border border-gray-300 rounded px-2.5 py-1.5 text-xs text-gray-900 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-gray-700 block mb-1">
                    Téléphone *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.phone}
                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full bg-white border border-gray-300 rounded px-2.5 py-1.5 font-mono text-xs text-gray-900 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-gray-700 block mb-1">
                    N° Registre de Commerce (RC)
                  </label>
                  <input
                    type="text"
                    placeholder="16/00-1234567B22"
                    value={formData.rc_number}
                    onChange={e => setFormData({ ...formData, rc_number: e.target.value })}
                    className="w-full bg-white border border-gray-300 rounded px-2.5 py-1.5 font-mono text-xs text-gray-900 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-gray-700 block mb-1">
                    NIF Fournisseur
                  </label>
                  <input
                    type="text"
                    placeholder="001516012345678"
                    value={formData.nif_number}
                    onChange={e => setFormData({ ...formData, nif_number: e.target.value })}
                    className="w-full bg-white border border-gray-300 rounded px-2.5 py-1.5 font-mono text-xs text-gray-900 focus:outline-none"
                  />
                </div>
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
                  className="flex-1 py-1.5 rounded bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-colors"
                >
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Règlement Dette Fournisseur */}
      {showPayModal && targetSupplier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white border border-gray-200 rounded-lg shadow-xl w-full max-w-sm overflow-hidden animate-in fade-in">
            <div className="p-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
              <span className="font-bold text-gray-900 text-sm">
                Règlement Fournisseur : {targetSupplier.name}
              </span>
              <button onClick={() => setShowPayModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmPay} className="p-4 space-y-3">
              <div className="p-2 rounded bg-gray-50 border border-gray-200 text-xs flex justify-between items-center">
                <span className="text-gray-600">Solde dû au fournisseur :</span>
                <span className="font-bold text-red-700 font-mono text-sm">
                  {CurrencyUtil.formatDZD(targetSupplier.current_balance)}
                </span>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-gray-700 block mb-1">
                  Mode de règlement
                </label>
                <select
                  value={payMethod}
                  onChange={e => setPayMethod(e.target.value as any)}
                  className="w-full bg-white border border-gray-300 rounded px-2.5 py-1.5 text-xs text-gray-900 focus:outline-none"
                >
                  <option value="TRANSFER">Virement Bancaire</option>
                  <option value="CHECK">Chèque Bancaire</option>
                  <option value="CASH">Espèces</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-gray-700 block mb-1">
                  Montant réglé (DA) *
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  max={targetSupplier.current_balance}
                  value={payAmount}
                  onChange={e => setPayAmount(e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded px-2.5 py-1.5 font-mono text-sm font-bold text-gray-900 focus:outline-none focus:border-blue-600"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-gray-700 block mb-1">
                  Référence chèque / virement
                </label>
                <input
                  type="text"
                  value={payRef}
                  onChange={e => setPayRef(e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded px-2.5 py-1.5 font-mono text-xs text-gray-900 focus:outline-none"
                />
              </div>

              <div className="p-3 border-t border-gray-200 bg-gray-50 flex space-x-2 -mx-4 -mb-4 mt-4">
                <button
                  type="button"
                  onClick={() => setShowPayModal(false)}
                  className="flex-1 py-1.5 rounded bg-white hover:bg-gray-100 border border-gray-300 text-gray-700 font-medium text-xs"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="flex-1 py-1.5 rounded bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-colors"
                >
                  Confirmer le Règlement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
