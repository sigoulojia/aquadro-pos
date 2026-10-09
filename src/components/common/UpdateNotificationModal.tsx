// Aquadro POS Algérie V2 — Fenêtre Interactive de Mise à Jour Automatique
// Gère l'affichage des versions, notes de version, progression du téléchargement et erreurs réseau

import React, { useState, useEffect } from 'react';
import { updateService, UpdateState } from '../../services/update.service';
import { Download, CheckCircle2, AlertTriangle, RefreshCw, X, Sparkles, ShieldCheck } from 'lucide-react';

export const UpdateNotificationModal: React.FC = () => {
  const [state, setState] = useState<UpdateState>(updateService.getState());
  const [isDismissed, setIsDismissed] = useState<boolean>(false);
  const [isInstalling, setIsInstalling] = useState<boolean>(false);

  useEffect(() => {
    const unsubscribe = updateService.subscribe((newState) => {
      setState(newState);
      if (newState.status === 'available') {
        setIsDismissed(false);
      }
    });
    return () => unsubscribe();
  }, []);

  const handleStartUpdate = async () => {
    try {
      setIsInstalling(true);
      await updateService.downloadAndInstall();
    } catch (err) {
      console.error('[UpdateModal] Error downloading update:', err);
    } finally {
      setIsInstalling(false);
    }
  };

  const handleDismiss = () => {
    setIsDismissed(true);
    updateService.dismiss();
  };

  // Only show modal when an update is available or actively downloading or error after manual trigger
  const shouldShow = !isDismissed && (
    state.status === 'available' || 
    state.status === 'downloading' || 
    state.status === 'downloaded' ||
    (state.status === 'error' && isInstalling)
  );

  if (!shouldShow || !state.updateInfo) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 w-full max-w-lg overflow-hidden flex flex-col">
        {/* En-tête */}
        <div className="bg-gradient-to-r from-blue-900 to-indigo-900 text-white p-6 relative">
          {!isInstalling && state.status !== 'downloading' && (
            <button
              onClick={handleDismiss}
              className="absolute top-4 right-4 p-1.5 rounded-full text-blue-200 hover:text-white hover:bg-white/10 transition-colors"
              title="Fermer"
            >
              <X className="w-5 h-5" />
            </button>
          )}
          <div className="flex items-center gap-3">
            <div className="p-3 bg-white/10 rounded-xl backdrop-blur-md">
              <Sparkles className="w-6 h-6 text-yellow-300" />
            </div>
            <div>
              <h3 className="text-xl font-bold tracking-tight">Nouvelle mise à jour disponible</h3>
              <p className="text-xs text-blue-200 flex items-center gap-1.5 mt-0.5">
                <ShieldCheck className="w-3.5 h-3.5 text-green-300" />
                Vérification cryptographique Minisign active
              </p>
            </div>
          </div>
        </div>

        {/* Corps */}
        <div className="p-6 space-y-5">
          {/* Badge de version */}
          <div className="flex items-center justify-between bg-gray-50 border border-gray-100 rounded-xl p-3.5">
            <div>
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Version actuelle</span>
              <p className="text-sm font-semibold text-gray-800">v{state.updateInfo.currentVersion}</p>
            </div>
            <div className="text-right">
              <span className="text-xs font-medium text-blue-600 uppercase tracking-wider">Nouvelle version</span>
              <p className="text-base font-bold text-blue-700">v{state.updateInfo.version}</p>
            </div>
          </div>

          {/* Notes de version */}
          {state.updateInfo.body && (
            <div>
              <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">
                Notes de version (Release Notes)
              </h4>
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 max-h-36 overflow-y-auto text-xs text-gray-700 whitespace-pre-line font-mono">
                {state.updateInfo.body}
              </div>
            </div>
          )}

          {/* État de téléchargement & progression */}
          {state.status === 'downloading' && (
            <div className="space-y-2 bg-blue-50/50 border border-blue-100 rounded-xl p-4">
              <div className="flex justify-between text-xs font-semibold text-blue-900">
                <span className="flex items-center gap-2">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600" />
                  Téléchargement de la mise à jour...
                </span>
                <span>{state.progress.percent}%</span>
              </div>
              <div className="w-full bg-blue-100 rounded-full h-2.5 overflow-hidden">
                <div
                  className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                  style={{ width: `${state.progress.percent}%` }}
                />
              </div>
              {state.progress.totalBytes > 0 && (
                <p className="text-[11px] text-gray-500 text-right">
                  {(state.progress.downloadedBytes / (1024 * 1024)).toFixed(1)} Mo / {(state.progress.totalBytes / (1024 * 1024)).toFixed(1)} Mo
                </p>
              )}
            </div>
          )}

          {/* État téléchargé / installation */}
          {state.status === 'downloaded' && (
            <div className="flex items-center gap-3 bg-green-50 border border-green-200 text-green-800 rounded-xl p-4 text-xs font-medium">
              <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
              <span>Téléchargement vérifié avec succès. Installation et redémarrage de l'application en cours...</span>
            </div>
          )}

          {/* Message d'erreur */}
          {state.error && (
            <div className="flex items-start gap-3 bg-red-50 border border-red-200 text-red-800 rounded-xl p-3.5 text-xs">
              <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold">Une erreur est survenue lors de la mise à jour</p>
                <p className="text-red-700">{state.error}</p>
                <p className="text-[11px] text-gray-500">
                  L'application continue de fonctionner normalement sans interruption de la caisse.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Pied de page Actions */}
        <div className="bg-gray-50 border-t border-gray-100 p-4 flex items-center justify-end gap-3">
          {state.status !== 'downloading' && state.status !== 'downloaded' && (
            <button
              onClick={handleDismiss}
              className="px-4 py-2.5 text-xs font-semibold text-gray-700 hover:text-gray-900 hover:bg-gray-200/60 rounded-xl transition-colors"
            >
              Plus tard
            </button>
          )}

          {state.status === 'available' && (
            <button
              onClick={handleStartUpdate}
              disabled={isInstalling}
              className="px-5 py-2.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-xl shadow-sm hover:shadow transition-all flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Installer maintenant
            </button>
          )}

          {state.status === 'error' && (
            <button
              onClick={handleStartUpdate}
              className="px-5 py-2.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Réessayer
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
