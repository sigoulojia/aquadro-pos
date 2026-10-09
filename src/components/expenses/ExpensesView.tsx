// Aquadro POS Algérie V2 — Gestion des Charges & Dépenses du Magasin
// Saisie des frais d'exploitation (Sonelgaz, Loyer, Emballage) avec déduction immédiate de la caisse

import React, { useState, useEffect } from 'react';
import { expenseService } from '../../services/expense.service';
import { caisseService } from '../../services/caisse.service';
import { Expense, ExpenseCategory } from '../../types/database';
import { CurrencyUtil } from '../../core/currency/currency';
import { useToast } from '../common/Toast';
import { useAuth } from '../../hooks/useAuth';
import {
  Wallet,
  Plus,
  Search,
  Calendar,
  X,
  CreditCard,
  Banknote
} from 'lucide-react';

export const ExpensesView: React.FC = () => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [search, setSearch] = useState<string>('');
  const [showAddModal, setShowAddModal] = useState<boolean>(false);

  const [formData, setFormData] = useState({
    category: 'ELECTRICITY' as ExpenseCategory,
    amount: 3500,
    paymentMethod: 'CASH' as 'CASH' | 'BANK',
    description: '',
    date: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    loadExpenses();
  }, []);

  const loadExpenses = async () => {
    const list = await expenseService.getExpenses();
    setExpenses(list);
  };

  const filtered = expenses.filter(e => {
    if (!search.trim()) return true;
    const q = search.toLowerCase().trim();
    return (
      e.description.toLowerCase().includes(q) ||
      e.category.toLowerCase().includes(q)
    );
  });

  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      const activeSession = await caisseService.getActiveSession();
      await expenseService.createExpense({
        category: formData.category,
        amount: formData.amount,
        paymentMethod: formData.paymentMethod,
        description: formData.description,
        date: formData.date,
        userId: user.id,
        userName: user.name,
        sessionId: activeSession?.id
      });

      showToast(`Charge de ${CurrencyUtil.formatDZD(formData.amount)} enregistrée`, 'success');
      setShowAddModal(false);
      setFormData({
        category: 'ELECTRICITY',
        amount: 3500,
        paymentMethod: 'CASH',
        description: '',
        date: new Date().toISOString().split('T')[0]
      });
      await loadExpenses();
    } catch (err: any) {
      showToast(`Erreur : ${err.message}`, 'error');
    }
  };

  const getCategoryLabel = (cat: ExpenseCategory) => {
    switch (cat) {
      case 'RENT': return 'Loyer Magasin';
      case 'ELECTRICITY': return 'Électricité (Sonelgaz)';
      case 'WATER': return 'Eau (Seaal)';
      case 'INTERNET': return 'Internet / Téléphone (Algérie Télécom)';
      case 'PACKAGING': return 'Sacs & Emballages';
      case 'TRANSPORT': return 'Transport & Livraison';
      case 'MAINTENANCE': return 'Entretien & Réparations';
      case 'CLEANING': return 'Nettoyage & Hygiène';
      case 'SUPPLIES': return 'Fournitures de Caisse';
      default: return 'Autre Dépense';
    }
  };

  return (
    <div className="flex-1 bg-gray-100 p-4 flex flex-col overflow-hidden text-xs select-none">
      {/* Barre d'outils supérieure */}
      <div className="flex items-center justify-between pb-3">
        <div>
          <h2 className="text-base font-bold text-gray-900">Charges & Dépenses du Magasin</h2>
          <span className="text-[11px] text-gray-500">
            {expenses.length} dépenses enregistrées
          </span>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center space-x-1 px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-sm transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Nouvelle Dépense</span>
        </button>
      </div>

      {/* Barre de Recherche */}
      <div className="bg-white p-2.5 rounded-t border border-gray-200 border-b-0 flex items-center space-x-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Rechercher par description ou catégorie..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-gray-50 border border-gray-300 rounded pl-8 pr-3 py-1.5 text-xs text-gray-900 focus:outline-none focus:border-blue-600"
          />
        </div>
      </div>

      {/* Tableau des Dépenses */}
      <div className="flex-1 bg-white border border-gray-200 rounded-b overflow-hidden flex flex-col">
        <div className="flex-1 overflow-y-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 text-[11px] sticky top-0">
              <tr>
                <th className="py-2.5 px-3 font-semibold">Date</th>
                <th className="py-2.5 px-3 font-semibold">Catégorie</th>
                <th className="py-2.5 px-3 font-semibold">Description / Motif</th>
                <th className="py-2.5 px-3 font-semibold">Mode de Paiement</th>
                <th className="py-2.5 px-3 font-semibold">Opérateur</th>
                <th className="py-2.5 px-3 font-semibold text-right">Montant</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-gray-400">
                    Aucune dépense enregistrée.
                  </td>
                </tr>
              ) : (
                filtered.map(e => (
                  <tr key={e.id} className="hover:bg-gray-50">
                    <td className="py-2 px-3 font-mono text-gray-600 text-[11px]">{e.date}</td>
                    <td className="py-2 px-3 font-medium text-gray-900">
                      {getCategoryLabel(e.category)}
                    </td>
                    <td className="py-2 px-3 text-gray-700">{e.description}</td>
                    <td className="py-2 px-3">
                      <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-gray-100 text-gray-700 border border-gray-200">
                        {e.payment_method === 'CASH' ? 'Espèces (Caisse)' : 'Banque'}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-gray-500">{e.user_name || 'Caissier'}</td>
                    <td className="py-2 px-3 text-right font-mono font-bold text-red-700">
                      -{CurrencyUtil.formatDZD(e.amount)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Ajout Dépense */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white border border-gray-200 rounded-lg shadow-xl w-full max-w-md overflow-hidden animate-in fade-in">
            <div className="p-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
              <span className="font-bold text-gray-900 text-sm">Enregistrer une Charge / Dépense</span>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateExpense} className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-gray-700 block mb-1">
                    Catégorie de dépense *
                  </label>
                  <select
                    value={formData.category}
                    onChange={e => setFormData({ ...formData, category: e.target.value as any })}
                    className="w-full bg-white border border-gray-300 rounded px-2.5 py-1.5 text-xs text-gray-900 focus:outline-none focus:border-blue-600"
                  >
                    <option value="ELECTRICITY">Électricité (Sonelgaz)</option>
                    <option value="WATER">Eau (Seaal)</option>
                    <option value="INTERNET">Internet / Téléphone</option>
                    <option value="RENT">Loyer Local</option>
                    <option value="PACKAGING">Sacs & Emballage</option>
                    <option value="TRANSPORT">Frais de Transport</option>
                    <option value="MAINTENANCE">Maintenance & Réparations</option>
                    <option value="SUPPLIES">Fournitures Diverses</option>
                    <option value="OTHER">Autre Dépense</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-gray-700 block mb-1">
                    Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.date}
                    onChange={e => setFormData({ ...formData, date: e.target.value })}
                    className="w-full bg-white border border-gray-300 rounded px-2.5 py-1.5 font-mono text-xs text-gray-900 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-gray-700 block mb-1">
                    Montant (DA) *
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={formData.amount}
                    onChange={e => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-white border border-gray-300 rounded px-2.5 py-1.5 font-mono text-sm font-bold text-gray-900 focus:outline-none focus:border-blue-600"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-gray-700 block mb-1">
                    Mode de Règlement
                  </label>
                  <select
                    value={formData.paymentMethod}
                    onChange={e => setFormData({ ...formData, paymentMethod: e.target.value as any })}
                    className="w-full bg-white border border-gray-300 rounded px-2.5 py-1.5 text-xs text-gray-900 focus:outline-none"
                  >
                    <option value="CASH">Espèces (Déduire du tiroir)</option>
                    <option value="BANK">Virement / Chèque Banque</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-gray-700 block mb-1">
                  Description / Justificatif *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Facture Sonelgaz 2ème trimestre, 100 sacs kraft..."
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  className="w-full bg-white border border-gray-300 rounded px-2.5 py-1.5 text-xs text-gray-900 focus:outline-none focus:border-blue-600"
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
                  Enregistrer la Dépense
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
