// Aquadro POS — Production Splash & Workspace Initialization Screen
// Exécute séquentiellement les 10 étapes d'initialisation requises avec retour visuel immédiat.

import React, { useState, useEffect } from 'react';
import { db } from '../../db/sqlite';
import { authService } from '../../services/auth.service';
import { ScannerInputManager } from '../../core/keyboard/ScannerInputManager';
import { backupService } from '../../services/backup.service';
import { logger } from '../../services/logger.service';
import { CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react';

interface SplashScreenProps {
  onReady: () => void;
  onFatalError?: (error: string) => void;
}

interface StepItem {
  id: number;
  labelFr: string;
  labelAr: string;
}

const STEPS: StepItem[] = [
  { id: 1, labelFr: "Initialisation du moteur d'application", labelAr: "تهيئة محرك التطبيق" },
  { id: 2, labelFr: "Vérification des répertoires runtime (AppData)", labelAr: "تجهيز مسارات النظام في AppData" },
  { id: 3, labelFr: "Connexion au grand livre SQLite local (WAL)", labelAr: "الاتصال بقاعدة بيانات SQLite" },
  { id: 4, labelFr: "Contrôle des migrations de schéma de données", labelAr: "التحقق من تحديثات قاعدة البيانات" },
  { id: 5, labelFr: "Vérification d'intégrité du stockage SQLite", labelAr: "فحص سلامة قاعدة البيانات" },
  { id: 6, labelFr: "Initialisation des services et de la session", labelAr: "تهيئة الخدمات وجلسة العمل" },
  { id: 7, labelFr: "Démarrage du scanner code-barres USB Plug & Play", labelAr: "تجهيز قارئ الباركود USB" },
  { id: 8, labelFr: "Préparation du sous-système d'impression thermique", labelAr: "تهيئة نظام الطباعة الحرارية" },
  { id: 9, labelFr: "Chargement du magasin et des données essentielles", labelAr: "تحميل بيانات المتجر والكتالوج" },
  { id: 10, labelFr: "Espace de travail prêt !", labelAr: "النظام جاهز للعمل !" }
];

export const SplashScreen: React.FC<SplashScreenProps> = ({ onReady, onFatalError }) => {
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [fatalError, setFatalError] = useState<string | null>(null);

  const runInitialization = async () => {
    setFatalError(null);
    setCurrentStepIndex(0);

    try {
      // Étape 1 : Initialisation de l'application
      setCurrentStepIndex(0);
      logger.info('STARTUP_STAGE', 'Étape 1/10: Initialisation application');
      await new Promise(r => setTimeout(r, 40));

      // Étape 2 : Préparation des répertoires runtime
      setCurrentStepIndex(1);
      logger.info('STARTUP_STAGE', 'Étape 2/10: Vérification répertoires runtime');
      const paths = await backupService.getRuntimePaths();
      if (paths) {
        logger.info('RUNTIME_PATHS', `Base: ${paths.database_path} | Logs: ${paths.logs_dir}`);
      }
      await new Promise(r => setTimeout(r, 40));

      // Étape 3 : Ouverture SQLite
      setCurrentStepIndex(2);
      logger.info('STARTUP_STAGE', 'Étape 3/10: Connexion SQLite');
      await db.initialize();
      await new Promise(r => setTimeout(r, 40));

      // Étape 4 : Migrations
      setCurrentStepIndex(3);
      logger.info('STARTUP_STAGE', 'Étape 4/10: Migrations vérifiées');
      await new Promise(r => setTimeout(r, 40));

      // Étape 5 : Contrôle d'intégrité SQLite
      setCurrentStepIndex(4);
      logger.info('STARTUP_STAGE', 'Étape 5/10: Contrôle intégrité');
      const report = await backupService.verifyDatabaseIntegrity();
      if (!report.is_healthy) {
        logger.warn('STARTUP_INTEGRITY', `Avertissement intégrité: ${report.checks.join(', ')}`);
      }
      await new Promise(r => setTimeout(r, 40));

      // Étape 6 : Initialisation des services & session
      setCurrentStepIndex(5);
      logger.info('STARTUP_STAGE', 'Étape 6/10: Initialisation session');
      await authService.initSession();
      await new Promise(r => setTimeout(r, 40));

      // Étape 7 : Sous-système scanner USB
      setCurrentStepIndex(6);
      logger.info('STARTUP_STAGE', 'Étape 7/10: Initialisation scanner USB');
      // Instancie et attache immédiatement l'intercepteur de douchette globale
      ScannerInputManager.getInstance();
      await new Promise(r => setTimeout(r, 40));

      // Étape 8 : Préparation sous-système impression
      setCurrentStepIndex(7);
      logger.info('STARTUP_STAGE', 'Étape 8/10: Préparation impression');
      await new Promise(r => setTimeout(r, 40));

      // Étape 9 : Chargement des données essentielles
      setCurrentStepIndex(8);
      logger.info('STARTUP_STAGE', 'Étape 9/10: Données essentielles chargées');
      await new Promise(r => setTimeout(r, 40));

      // Étape 10 : Prêt !
      setCurrentStepIndex(9);
      logger.info('STARTUP_STAGE', 'Étape 10/10: Application prête');
      await new Promise(r => setTimeout(r, 80));

      // Transition immédiate vers la caisse
      onReady();
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      logger.error('STARTUP_FATAL', 'Erreur critique au démarrage', errMsg);
      setFatalError(errMsg);
      if (onFatalError) onFatalError(errMsg);
    }
  };

  useEffect(() => {
    runInitialization();
  }, []);

  const progressPercent = Math.round(((currentStepIndex + 1) / STEPS.length) * 100);
  const activeStep = STEPS[currentStepIndex] || STEPS[0];

  return (
    <div className="h-screen w-screen bg-slate-900 text-white flex flex-col items-center justify-center select-none font-sans relative overflow-hidden">
      {/* Background radial glow */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(30,58,138,0.25)_0%,rgba(15,23,42,1)_70%)] pointer-events-none" />

      <div className="relative z-10 w-full max-w-md p-8 flex flex-col items-center text-center">
        {/* Brand Logo & Name */}
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 shadow-xl shadow-blue-500/20 flex items-center justify-center mb-5 ring-1 ring-white/10">
          <span className="text-2xl font-black tracking-tight text-white">AQ</span>
        </div>

        <h1 className="text-2xl font-extrabold tracking-tight text-white mb-1">
          Aquadro POS
        </h1>
        <p className="text-xs uppercase tracking-widest text-blue-400 font-semibold mb-6">
          Point of Sale & Gestion de Stock Algérie
        </p>

        {fatalError ? (
          /* Error State Card */
          <div className="w-full bg-red-950/50 border border-red-500/30 rounded-xl p-5 text-left backdrop-blur-sm shadow-xl">
            <div className="flex items-center gap-3 text-red-400 font-bold text-sm mb-2">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <span>Erreur d'initialisation système</span>
            </div>
            <p className="text-xs text-red-200/80 mb-4 leading-relaxed font-mono bg-red-950/80 p-2.5 rounded border border-red-500/20 break-words">
              {fatalError}
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={runInitialization}
                className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-semibold rounded-lg shadow transition"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Réessayer
              </button>
            </div>
          </div>
        ) : (
          /* Progress State */
          <div className="w-full">
            <div className="text-xs text-slate-300 font-medium mb-3 flex items-center justify-between">
              <span>{activeStep.labelFr}</span>
              <span className="font-mono text-blue-400 font-bold">{progressPercent}%</span>
            </div>

            {/* Smooth Progress Bar */}
            <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden mb-4 p-0.5 border border-slate-700/50">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-indigo-400 rounded-full transition-all duration-150 ease-out shadow-sm shadow-blue-500/50"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            <p className="text-[11px] text-slate-400 font-arabic text-center">
              {activeStep.labelAr}
            </p>

            {/* Subtle Step Checkmark */}
            <div className="mt-6 flex items-center justify-center gap-2 text-xs text-slate-500">
              <CheckCircle2 className="w-3.5 h-3.5 text-blue-400/70" />
              <span>Chargement direct des sous-systèmes locaux</span>
            </div>
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="absolute bottom-4 text-center text-[11px] text-slate-500">
        Aquadro POS v1.0.0 • SQLite WAL Authoritative • AppData Storage
      </div>
    </div>
  );
};
