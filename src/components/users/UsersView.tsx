// Aquadro POS Algérie V2 — Gestion des Utilisateurs & Attribution des Rôles (RBAC)
// Création d'employés avec hachage sécurisé du PIN et vérification stricte anti-combinaisons triviales

import React, { useState, useEffect } from 'react';
import { authService } from '../../services/auth.service';
import { User, UserRole } from '../../types/database';
import { useToast } from '../common/Toast';
import {
  UserCog,
  Plus,
  Shield,
  KeyRound,
  X,
  Phone,
  CheckCircle2
} from 'lucide-react';

export const UsersView: React.FC = () => {
  const { showToast } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [showChangePinModal, setShowChangePinModal] = useState<boolean>(false);
  const [showDeactivateModal, setShowDeactivateModal] = useState<boolean>(false);
  const [selectedUserForPin, setSelectedUserForPin] = useState<User | null>(null);
  const [selectedUserForDeactivation, setSelectedUserForDeactivation] = useState<User | null>(null);
  const [newPin, setNewPin] = useState<string>('');

  const [formData, setFormData] = useState({
    name: '',
    role: 'cashier' as UserRole,
    pin: '',
    phone: ''
  });

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    const list = await authService.getAllUsers();
    setUsers(list);
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await authService.createUser(formData);
      showToast(`Utilisateur ${formData.name} créé avec succès`, 'success');
      setShowAddModal(false);
      setFormData({ name: '', role: 'cashier', pin: '', phone: '' });
      await loadUsers();
    } catch (err: any) {
      showToast(`Erreur : ${err.message}`, 'error');
    }
  };

  const handleUpdatePin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserForPin) return;
    try {
      await authService.updateUserPin(selectedUserForPin.id, newPin);
      showToast(`Le code PIN de ${selectedUserForPin.name} a été modifié.`, 'success');
      setShowChangePinModal(false);
      setNewPin('');
    } catch (err: any) {
      showToast(`Erreur : ${err.message}`, 'error');
    }
  };

  const handleDeactivate = async () => {
    if (!selectedUserForDeactivation) return;
    try {
      await authService.deactivateUser(selectedUserForDeactivation.id);
      showToast(`L'utilisateur ${selectedUserForDeactivation.name} a été désactivé.`, 'success');
      setShowDeactivateModal(false);
      await loadUsers();
    } catch (err: any) {
      showToast(`Erreur : ${err.message}`, 'error');
    }
  };

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'owner':
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200">PROPRIÉTAIRE</span>;
      case 'manager':
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">RESPONSABLE</span>;
      default:
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-gray-100 text-gray-800 border border-gray-200">CAISSIER</span>;
    }
  };

  return (
    <div className="flex-1 bg-gray-100 p-4 flex flex-col overflow-hidden text-xs select-none">
      {/* Barre d'outils supérieure */}
      <div className="flex items-center justify-between pb-3">
        <div>
          <h2 className="text-base font-bold text-gray-900">Utilisateurs & Contrôle d'Accès (RBAC)</h2>
          <span className="text-[11px] text-gray-500">
            Comptes employés et codes PIN sécurisés avec sel cryptographique
          </span>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center space-x-1 px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-sm transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Nouvel Utilisateur</span>
        </button>
      </div>

      {/* Tableau des Utilisateurs */}
      <div className="flex-1 bg-white border border-gray-200 rounded overflow-hidden flex flex-col">
        <div className="flex-1 overflow-y-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 text-[11px] sticky top-0">
              <tr>
                <th className="py-2.5 px-3 font-semibold">Nom Complet</th>
                <th className="py-2.5 px-3 font-semibold">Rôle & Droits</th>
                <th className="py-2.5 px-3 font-semibold">Téléphone</th>
                <th className="py-2.5 px-3 font-semibold">Sécurité PIN</th>
                <th className="py-2.5 px-3 font-semibold text-center">Statut</th>
                <th className="py-2.5 px-3 font-semibold text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map(u => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="py-2 px-3 font-semibold text-gray-900">{u.name}</td>
                  <td className="py-2 px-3">{getRoleBadge(u.role)}</td>
                  <td className="py-2 px-3 font-mono text-gray-600">{u.phone || '—'}</td>
                  <td className="py-2 px-3 font-mono text-gray-400 text-[11px]">
                    <span className="flex items-center space-x-1 text-emerald-700">
                      <KeyRound className="w-3 h-3 text-emerald-600" />
                      <span>Haché SHA-256 (Protégé)</span>
                    </span>
                  </td>
                  <td className="py-2 px-3 text-center">
                    <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                      ACTIF
                    </span>
                  </td>
                  <td className="py-2 px-3 text-center space-x-2">
                    <button
                      onClick={() => {
                        setSelectedUserForPin(u);
                        setShowChangePinModal(true);
                      }}
                      className="text-[10px] font-bold text-blue-600 hover:text-blue-800 bg-blue-50 px-2 py-1 rounded"
                    >
                      Changer PIN
                    </button>
                    <button
                      onClick={() => {
                        setSelectedUserForDeactivation(u);
                        setShowDeactivateModal(true);
                      }}
                      className="text-[10px] font-bold text-red-600 hover:text-red-800 bg-red-50 px-2 py-1 rounded"
                    >
                      Désactiver
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Création Utilisateur */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white border border-gray-200 rounded-lg shadow-xl w-full max-w-sm overflow-hidden animate-in fade-in">
            <div className="p-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
              <span className="font-bold text-gray-900 text-sm">Ajouter un Collaborateur</span>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="p-4 space-y-3">
              <div>
                <label className="text-[11px] font-semibold text-gray-700 block mb-1">
                  Nom & Prénom *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-white border border-gray-300 rounded px-2.5 py-1.5 text-xs text-gray-900 focus:outline-none focus:border-blue-600"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-gray-700 block mb-1">
                  Rôle Système *
                </label>
                <select
                  value={formData.role}
                  onChange={e => setFormData({ ...formData, role: e.target.value as UserRole })}
                  className="w-full bg-white border border-gray-300 rounded px-2.5 py-1.5 text-xs text-gray-900 focus:outline-none focus:border-blue-600"
                >
                  <option value="cashier">Caissier (Ventes et encaissement)</option>
                  <option value="manager">Responsable (Remises, retours, clôture)</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-gray-700 block mb-1">
                  Téléphone
                </label>
                <input
                  type="text"
                  placeholder="0550 12 34 56"
                  value={formData.phone}
                  onChange={e => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full bg-white border border-gray-300 rounded px-2.5 py-1.5 font-mono text-xs text-gray-900 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-gray-700 block mb-1">
                  Code PIN de Sécurité (4 à 8 chiffres) *
                </label>
                <input
                  type="password"
                  required
                  placeholder="••••"
                  value={formData.pin}
                  onChange={e => setFormData({ ...formData, pin: e.target.value })}
                  className="w-full bg-white border border-gray-300 rounded px-2.5 py-1.5 font-mono text-sm tracking-widest text-center text-gray-900 focus:outline-none focus:border-blue-600"
                />
                <span className="text-[10px] text-gray-400 block mt-1">
                  Combinaisons évidentes (1234, 0000, 1111) interdites.
                </span>
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
                  Créer le Compte
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Changement PIN */}
      {showChangePinModal && selectedUserForPin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white border border-gray-200 rounded-lg shadow-xl w-full max-w-sm overflow-hidden animate-in fade-in">
            <div className="p-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
              <span className="font-bold text-gray-900 text-sm">Changer le PIN de {selectedUserForPin.name}</span>
              <button onClick={() => setShowChangePinModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleUpdatePin} className="p-4 space-y-3">
              <div>
                <label className="text-[11px] font-semibold text-gray-700 block mb-1">
                  Nouveau Code PIN *
                </label>
                <input
                  type="password"
                  required
                  placeholder="Nouveau PIN..."
                  value={newPin}
                  onChange={e => setNewPin(e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded px-2.5 py-1.5 font-mono text-sm tracking-widest text-center text-gray-900 focus:outline-none focus:border-blue-600"
                />
              </div>
              <div className="p-3 border-t border-gray-200 bg-gray-50 flex space-x-2 -mx-4 -mb-4 mt-4">
                <button
                  type="button"
                  onClick={() => setShowChangePinModal(false)}
                  className="flex-1 py-1.5 rounded bg-white hover:bg-gray-100 border border-gray-300 text-gray-700 font-medium text-xs"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="flex-1 py-1.5 rounded bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-colors"
                >
                  Mettre à jour
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Confirmation Désactivation */}
      {showDeactivateModal && selectedUserForDeactivation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white border border-gray-200 rounded-lg shadow-xl w-full max-w-sm overflow-hidden animate-in fade-in">
            <div className="p-3 border-b border-gray-200 bg-red-50 flex items-center justify-between">
              <span className="font-bold text-red-900 text-sm">Désactiver le compte</span>
              <button onClick={() => setShowDeactivateModal(false)} className="text-red-400 hover:text-red-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4">
              <p className="text-xs text-gray-700 mb-4">
                Voulez-vous vraiment désactiver l'accès pour <strong>{selectedUserForDeactivation.name}</strong> ?<br/><br/>
                Cet utilisateur ne pourra plus se connecter. Ses opérations passées resteront intactes pour l'audit.
              </p>
              <div className="flex space-x-2 mt-2">
                <button
                  type="button"
                  onClick={() => setShowDeactivateModal(false)}
                  className="flex-1 py-1.5 rounded bg-white hover:bg-gray-100 border border-gray-300 text-gray-700 font-medium text-xs"
                >
                  Annuler
                </button>
                <button
                  onClick={handleDeactivate}
                  className="flex-1 py-1.5 rounded bg-red-600 hover:bg-red-700 text-white font-bold text-xs transition-colors"
                >
                  Désactiver
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
