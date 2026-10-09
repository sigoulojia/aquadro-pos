// Aquadro POS Algérie V2 — Gestion des Clients & Crédits / Dettes Locales
// Table des athlètes, suivi des encours et enregistrement des versements d'acomptes

import React, { useState, useEffect } from 'react';
import { customerService } from '../../services/customer.service';
import { Customer } from '../../types/database';
import { CurrencyUtil } from '../../core/currency/currency';
import { useToast } from '../common/Toast';
import { useAuth } from '../../hooks/useAuth';
import { AlgeriaCities } from '../../data/AlgeriaCities';
import {
  Users,
  Plus,
  Search,
  Phone,
  CreditCard,
  Banknote,
  Award,
  X,
  Edit2
} from 'lucide-react';

export const CustomersView: React.FC = () => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState<string>('');

  // Modal Création / Modification
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    wilaya: '16 - Alger',
    notes: '',
    credit_limit: 20000
  });

  // Modal Versement d'acompte / Paiement dette
  const [showPayDebtModal, setShowPayDebtModal] = useState<boolean>(false);
  const [targetCustomer, setTargetCustomer] = useState<Customer | null>(null);
  const [debtPayAmount, setDebtPayAmount] = useState<string>('');

  useEffect(() => {
    loadCustomers();
  }, []);

  const loadCustomers = async () => {
    const list = await customerService.getCustomers();
    setCustomers(list);
  };

  const filtered = customers.filter(c => {
    if (!search.trim()) return true;
    const q = search.toLowerCase().trim();
    return (
      c.name.toLowerCase().includes(q) ||
      (c.phone && c.phone.includes(q)) ||
      (c.wilaya && c.wilaya.toLowerCase().includes(q))
    );
  });

  const handleOpenCreate = () => {
    setEditingCustomer(null);
    setFormData({
      name: '',
      phone: '0550 12 34 56',
      wilaya: '16 - Alger',
      notes: '',
      credit_limit: 20000
    });
    setShowAddModal(true);
  };

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingCustomer) {
        await customerService.updateCustomer(editingCustomer.id, formData);
        showToast('Fiche client mise à jour', 'success');
      } else {
        await customerService.createCustomer(formData);
        showToast('Client enregistré avec succès', 'success');
      }
      setShowAddModal(false);
      await loadCustomers();
    } catch (err: any) {
      showToast(`Erreur : ${err.message}`, 'error');
    }
  };

  const handleOpenPayDebt = (c: Customer) => {
    setTargetCustomer(c);
    setDebtPayAmount(c.current_debt.toString());
    setShowPayDebtModal(true);
  };

  const handleConfirmPayDebt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetCustomer || !user) return;
    const amount = parseFloat(debtPayAmount) || 0;
    try {
      await customerService.recordCreditPayment({
        customerId: targetCustomer.id,
        amount,
        paymentMethod: 'CASH',
        cashierId: user.id,
        reference: `Versement direct comptoir`
      });
      showToast(`Versement de ${CurrencyUtil.formatDZD(amount)} enregistré pour ${targetCustomer.name}`, 'success');
      setShowPayDebtModal(false);
      await loadCustomers();
    } catch (err: any) {
      showToast(`Erreur : ${err.message}`, 'error');
    }
  };

  return (
    <div className="flex-1 bg-gray-100 p-4 flex flex-col overflow-hidden text-xs select-none">
      {/* Barre d'outils supérieure */}
      <div className="flex items-center justify-between pb-3">
        <div>
          <h2 className="text-base font-bold text-gray-900">Clients & Crédits (Dettes)</h2>
          <span className="text-[11px] text-gray-500">
            {customers.length} athlètes et clients enregistrés
          </span>
        </div>

        <button
          onClick={handleOpenCreate}
          className="flex items-center space-x-1 px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-sm transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Nouveau Client</span>
        </button>
      </div>

      {/* Barre de Recherche */}
      <div className="bg-white p-2.5 rounded-t border border-gray-200 border-b-0 flex items-center space-x-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Rechercher par nom, téléphone, wilaya..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-gray-50 border border-gray-300 rounded pl-8 pr-3 py-1.5 text-xs text-gray-900 focus:outline-none focus:border-blue-600"
          />
        </div>
      </div>

      {/* Tableau des Clients */}
      <div className="flex-1 bg-white border border-gray-200 rounded-b overflow-hidden flex flex-col">
        <div className="flex-1 overflow-y-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 text-[11px] sticky top-0">
              <tr>
                <th className="py-2.5 px-3 font-semibold">Nom & Prénom</th>
                <th className="py-2.5 px-3 font-semibold">Téléphone</th>
                <th className="py-2.5 px-3 font-semibold">Wilaya</th>
                <th className="py-2.5 px-3 font-semibold text-right">Plafond Crédit</th>
                <th className="py-2.5 px-3 font-semibold text-right">Dette Actuelle</th>
                <th className="py-2.5 px-3 font-semibold text-center">Fidélité</th>
                <th className="py-2.5 px-3 font-semibold text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-gray-400">
                    Aucun client trouvé.
                  </td>
                </tr>
              ) : (
                filtered.map(c => (
                  <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                    <td className="py-2 px-3 font-semibold text-gray-900">{c.name}</td>
                    <td className="py-2 px-3 font-mono text-gray-600">{c.phone || '—'}</td>
                    <td className="py-2 px-3 text-gray-500">{c.wilaya || '16 - Alger'}</td>
                    <td className="py-2 px-3 text-right font-mono text-gray-500">
                      {CurrencyUtil.formatDZD(c.credit_limit)}
                    </td>
                    <td className="py-2 px-3 text-right font-mono font-bold">
                      <span className={c.current_debt > 0 ? 'text-red-700' : 'text-emerald-700'}>
                        {CurrencyUtil.formatDZD(c.current_debt)}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-center">
                      <span className="px-1.5 py-0.2 rounded text-[10px] font-bold font-mono bg-amber-50 text-amber-800 border border-amber-200">
                        {c.loyalty_points} pts
                      </span>
                    </td>
                    <td className="py-2 px-3 text-center">
                      <div className="flex items-center justify-center space-x-1">
                        {c.current_debt > 0 && (
                          <button
                            onClick={() => handleOpenPayDebt(c)}
                            className="px-2 py-0.5 rounded bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-800 font-semibold text-[11px]"
                            title="Régler acompte"
                          >
                            Régler Dette
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setEditingCustomer(c);
                            setFormData({
                              name: c.name,
                              phone: c.phone || '',
                              wilaya: c.wilaya || '16 - Alger',
                              notes: c.notes || '',
                              credit_limit: c.credit_limit
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

      {/* Modal Création / Modification Client */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white border border-gray-200 rounded-lg shadow-xl w-full max-w-md overflow-hidden animate-in fade-in">
            <div className="p-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
              <span className="font-bold text-gray-900 text-sm">
                {editingCustomer ? 'Modifier Fiche Client' : 'Nouveau Client'}
              </span>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveCustomer} className="p-4 space-y-3">
              <div>
                <label className="text-[11px] font-semibold text-gray-700 block mb-1">
                  Nom complet du client *
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
                    Téléphone (Algérie) *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="0550 12 34 56"
                    value={formData.phone}
                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full bg-white border border-gray-300 rounded px-2.5 py-1.5 font-mono text-xs text-gray-900 focus:outline-none focus:border-blue-600"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-gray-700 block mb-1">
                    Wilaya
                  </label>
                  <select
                    value={formData.wilaya}
                    onChange={e => setFormData({ ...formData, wilaya: e.target.value })}
                    className="w-full bg-white border border-gray-300 rounded px-2.5 py-1.5 text-xs text-gray-900 focus:outline-none focus:border-blue-600"
                  >
                    {AlgeriaCities.getWilayas().map(w => (
                      <option key={w.code} value={w.label}>{w.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-gray-700 block mb-1">
                  Plafond de Crédit Autorisé (DA)
                </label>
                <input
                  type="number"
                  value={formData.credit_limit}
                  onChange={e => setFormData({ ...formData, credit_limit: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-white border border-gray-300 rounded px-2.5 py-1.5 font-mono text-xs text-gray-900 focus:outline-none focus:border-blue-600"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-gray-700 block mb-1">
                  Notes & Profil (Salle, Objectifs)
                </label>
                <input
                  type="text"
                  placeholder="Ex: Prépare compétition, prend uniquement Isolat..."
                  value={formData.notes}
                  onChange={e => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full bg-white border border-gray-300 rounded px-2.5 py-1.5 text-xs text-gray-900 focus:outline-none"
                />
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

      {/* Modal Versement Acompte Dette */}
      {showPayDebtModal && targetCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white border border-gray-200 rounded-lg shadow-xl w-full max-w-sm overflow-hidden animate-in fade-in">
            <div className="p-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
              <span className="font-bold text-gray-900 text-sm">
                Règlement Dette : {targetCustomer.name}
              </span>
              <button onClick={() => setShowPayDebtModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmPayDebt} className="p-4 space-y-3">
              <div className="p-2 rounded bg-gray-50 border border-gray-200 text-xs flex justify-between items-center">
                <span className="text-gray-600">Dette actuelle :</span>
                <span className="font-bold text-red-700 font-mono text-sm">
                  {CurrencyUtil.formatDZD(targetCustomer.current_debt)}
                </span>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-gray-700 block mb-1">
                  Montant versé en espèces (DA) *
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  max={targetCustomer.current_debt}
                  value={debtPayAmount}
                  onChange={e => setDebtPayAmount(e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded px-2.5 py-1.5 font-mono text-sm font-bold text-gray-900 focus:outline-none focus:border-blue-600"
                />
              </div>

              <div className="p-3 border-t border-gray-200 bg-gray-50 flex space-x-2 -mx-4 -mb-4 mt-4">
                <button
                  type="button"
                  onClick={() => setShowPayDebtModal(false)}
                  className="flex-1 py-1.5 rounded bg-white hover:bg-gray-100 border border-gray-300 text-gray-700 font-medium text-xs"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="flex-1 py-1.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-colors"
                >
                  Valider le Versement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
