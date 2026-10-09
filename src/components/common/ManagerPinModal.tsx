// Aquadro POS Algérie V2 — Boîte de dialogue d'autorisation Manager / Responsable
// Design épuré blanc ERP, clavier numérique compact, vérification sécurisée par sel cryptographique

import React, { useState } from 'react';
import { ShieldCheck, X } from 'lucide-react';
import { authService } from '../../services/auth.service';

interface ManagerPinModalProps {
  isOpen: boolean;
  title: string;
  description: string;
  onSuccess: (managerName: string) => void;
  onCancel: () => void;
}

export const ManagerPinModal: React.FC<ManagerPinModalProps> = ({
  isOpen,
  title,
  description,
  onSuccess,
  onCancel
}) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleDigit = (digit: string) => {
    if (pin.length < 8) {
      setPin(prev => prev + digit);
      setError(null);
    }
  };

  const handleBackspace = () => {
    setPin(prev => prev.slice(0, -1));
    setError(null);
  };

  const handleClear = () => {
    setPin('');
    setError(null);
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!pin) {
      setError('Veuillez saisir le code PIN du Responsable');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const manager = await authService.verifyManagerPin(pin);
      if (manager) {
        setIsLoading(false);
        setPin('');
        onSuccess(manager.name);
      } else {
        setIsLoading(false);
        setError('Code PIN invalide ou privilèges insuffisants.');
      }
    } catch (err: any) {
      setIsLoading(false);
      setError('Erreur lors de la vérification des identifiants');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px] p-4 select-none">
      <div className="bg-white border border-gray-300 w-full max-w-sm rounded shadow-xl overflow-hidden animate-in fade-in duration-100">
        {/* En-tête sobre blanc */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-5 h-5 text-blue-700" />
            <div>
              <h3 className="text-sm font-bold text-gray-900">{title}</h3>
              <p className="text-[11px] text-gray-500">Autorisation d'un Responsable requise</p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-700 p-1 rounded hover:bg-gray-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Corps */}
        <div className="p-4">
          <p className="text-xs text-gray-600 mb-3 text-center">{description}</p>

          {/* Indicateur de saisie PIN */}
          <div className="flex justify-center items-center space-x-2.5 mb-4 py-2 bg-gray-50 border border-gray-200 rounded">
            {[0, 1, 2, 3, 4, 5].map((_, idx) => (
              <div
                key={idx}
                className={`w-3 h-3 rounded-full border transition-all ${
                  idx < pin.length
                    ? 'bg-blue-600 border-blue-700 scale-110'
                    : 'border-gray-300 bg-white'
                }`}
              />
            ))}
          </div>

          {error && (
            <div className="mb-3 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded p-2 text-center">
              {error}
            </div>
          )}

          {/* Pavé numérique compact */}
          <div className="grid grid-cols-3 gap-1.5 mb-4">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
              <button
                key={num}
                type="button"
                onClick={() => handleDigit(num.toString())}
                className="py-2.5 rounded bg-white hover:bg-gray-100 text-base font-semibold text-gray-800 border border-gray-300 active:bg-gray-200"
              >
                {num}
              </button>
            ))}
            <button
              type="button"
              onClick={handleClear}
              className="py-2.5 rounded bg-gray-50 hover:bg-gray-100 text-xs font-semibold text-gray-500 border border-gray-200"
            >
              EFFACER
            </button>
            <button
              type="button"
              onClick={() => handleDigit('0')}
              className="py-2.5 rounded bg-white hover:bg-gray-100 text-base font-semibold text-gray-800 border border-gray-300 active:bg-gray-200"
            >
              0
            </button>
            <button
              type="button"
              onClick={handleBackspace}
              className="py-2.5 rounded bg-gray-50 hover:bg-gray-100 text-sm font-semibold text-gray-500 border border-gray-200"
            >
              ⌫
            </button>
          </div>

          {/* Boutons d'action */}
          <div className="flex space-x-2">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 py-2 rounded bg-gray-100 hover:bg-gray-200 text-xs font-medium text-gray-700 border border-gray-300"
            >
              Annuler
            </button>
            <button
              type="button"
              disabled={isLoading || pin.length === 0}
              onClick={() => handleSubmit()}
              className="flex-1 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold border border-blue-700 disabled:opacity-50"
            >
              {isLoading ? 'Vérification...' : 'Autoriser'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
