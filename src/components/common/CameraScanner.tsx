import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { Camera, X, CheckCircle2, Barcode, Scan, Sparkles } from 'lucide-react';
import { ScannerInputManager } from '../../core/keyboard/ScannerInputManager';

interface CameraScannerProps {
  onScanSuccess: (decodedText: string) => void;
  onClose: () => void;
  title?: string;
}

// Bip sonore professionnel de caisse enregistreuse (Web Audio API)
const playScannerBeep = () => {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const audioCtx = new AudioContextClass();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(1850, audioCtx.currentTime); // Fréquence classique des lecteurs Honeywell / Datalogic
    gain.gain.setValueAtTime(0.18, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.12);

    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.12);
  } catch {
    // Audio context non disponible
  }
};

export const CameraScanner: React.FC<CameraScannerProps> = ({ onScanSuccess, onClose, title }) => {
  const [manualCode, setManualCode] = useState<string>('');
  const [scannedCode, setScannedCode] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isCapturedRef = useRef<boolean>(false);

  // Traitement du succès de capture (caméra, douchette, ou manuel)
  const handleCapturedCode = useCallback((code: string) => {
    const cleanCode = code.trim();
    if (!cleanCode || isCapturedRef.current) return;

    isCapturedRef.current = true;
    setScannedCode(cleanCode);
    setIsSuccess(true);
    playScannerBeep();

    // Arrêt immédiat de la caméra si active
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          scannerRef.current.stop().catch(() => {});
        }
      } catch {
        // Ignorer
      }
    }

    // Temporisation brève (650ms) pour que l'utilisateur voie la validation visuelle verte
    setTimeout(() => {
      onScanSuccess(cleanCode);
      onClose();
    }, 650);
  }, [onScanSuccess, onClose]);

  // Écoute de la douchette physique ou saisie rapide clavier via ScannerInputManager
  useEffect(() => {
    const scannerManager = ScannerInputManager.getInstance();
    const unsubscribe = scannerManager.subscribe((barcode) => {
      handleCapturedCode(barcode);
    });
    return () => unsubscribe();
  }, [handleCapturedCode]);

  // Initialisation propre de la caméra
  useEffect(() => {
    let isMounted = true;

    const startScanner = async () => {
      try {
        const html5QrCode = new Html5Qrcode("reader", {
          verbose: false,
          formatsToSupport: [
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.CODE_39,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E,
            Html5QrcodeSupportedFormats.QR_CODE
          ]
        });
        scannerRef.current = html5QrCode;

        await html5QrCode.start(
          { facingMode: "environment" },
          {
            fps: 12,
            qrbox: { width: 220, height: 120 }
          },
          (decodedText) => {
            if (isMounted) {
              handleCapturedCode(decodedText);
            }
          },
          () => {
            // Pas de code détecté dans cette frame
          }
        );

        if (isMounted) {
          setCameraActive(true);
          setCameraError(null);
        }
      } catch (err: any) {
        if (isMounted) {
          console.warn("Caméra non disponible ou refusée:", err);
          setCameraActive(false);
          setCameraError("Caméra non détectée. Utilisez le lecteur code-barres ou la saisie ci-dessous.");
        }
      }
    };

    startScanner();

    return () => {
      isMounted = false;
      if (scannerRef.current) {
        try {
          if (scannerRef.current.isScanning) {
            scannerRef.current.stop().catch(() => {});
          }
          scannerRef.current.clear();
        } catch {
          // Ignorer lors du démontage
        }
      }
    };
  }, [handleCapturedCode]);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualCode.trim()) {
      handleCapturedCode(manualCode);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 select-none animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden border border-gray-100 flex flex-col transition-all transform scale-100">
        
        {/* En-tête compact */}
        <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-gray-900 to-gray-800 text-white">
          <div className="flex items-center space-x-2 space-x-reverse">
            <div className="w-7 h-7 rounded-lg bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-400">
              <Scan className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-xs tracking-wide text-white">
                {title || 'التقاط الباركود / Scanner'}
              </h3>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose} 
            className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Message d'instruction principal demandé par l'utilisateur */}
        <div className="bg-blue-50/70 border-b border-blue-100/60 px-4 py-2.5 text-center">
          <div className="flex items-center justify-center space-x-1.5 space-x-reverse text-blue-900 font-bold text-sm">
            <Sparkles className="w-4 h-4 text-blue-600 animate-pulse" />
            <span>ضع الباركود أمام السكانر</span>
          </div>
          <p className="text-[11px] text-blue-700/80 mt-0.5">
            Placez le code-barres devant le scanner
          </p>
        </div>

        {/* Zone de scan compacte */}
        <div className="p-4 bg-gray-50 flex flex-col items-center">
          <div 
            id="reader-container" 
            className={`relative w-full h-44 rounded-xl overflow-hidden border-2 transition-all duration-300 flex items-center justify-center shadow-inner ${
              isSuccess 
                ? 'bg-emerald-950 border-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.35)]' 
                : 'bg-gray-950 border-gray-700/80'
            }`}
          >
            {/* Élément Html5Qrcode contraint dans le conteneur */}
            <div 
              id="reader" 
              className={`w-full h-full ${cameraActive && !isSuccess ? 'block' : 'hidden'}`}
            />

            {/* Vue de remplacement si caméra désactivée ou en cours de chargement */}
            {(!cameraActive || isSuccess) && (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-3 text-center z-0">
                {isSuccess ? (
                  <div className="flex flex-col items-center justify-center animate-scaleUp">
                    <div className="w-14 h-14 rounded-full bg-emerald-500/20 border-2 border-emerald-400 flex items-center justify-center mb-2 shadow-lg shadow-emerald-500/20">
                      <CheckCircle2 className="w-8 h-8 text-emerald-400 animate-pulse" />
                    </div>
                    <span className="text-emerald-400 font-bold text-sm">
                      تم التقاط الباركود بنجاح!
                    </span>
                    <span className="text-emerald-200/80 text-[11px] mt-0.5">
                      Code-barres capturé avec succès
                    </span>
                    <span className="mt-2 px-3 py-1 bg-emerald-900/60 border border-emerald-500/40 text-emerald-300 font-mono text-xs font-bold rounded-lg tracking-wider">
                      {scannedCode}
                    </span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center opacity-85">
                    <Barcode className="w-14 h-14 text-gray-500/60 mb-2" />
                    <div className="flex items-center space-x-1.5 space-x-reverse text-emerald-400 bg-emerald-950/60 px-2.5 py-1 rounded-full border border-emerald-800/60 text-[11px] font-medium shadow-sm">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                      <span>جاهز للالتقاط</span>
                    </div>
                    {cameraError && (
                      <span className="text-[10px] text-gray-400 mt-2 max-w-[240px]">
                        السكانر واللوحة اليدوية في وضع الاستعداد
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Viseur cible avec coins lumineux */}
            {!isSuccess && (
              <div className="absolute inset-x-8 inset-y-5 border-2 border-dashed border-emerald-400/40 rounded-lg pointer-events-none flex items-center justify-center">
                {/* Coins de cadrage */}
                <div className="absolute -top-1 -left-1 w-3 h-3 border-t-2 border-l-2 border-emerald-400"></div>
                <div className="absolute -top-1 -right-1 w-3 h-3 border-t-2 border-r-2 border-emerald-400"></div>
                <div className="absolute -bottom-1 -left-1 w-3 h-3 border-b-2 border-l-2 border-emerald-400"></div>
                <div className="absolute -bottom-1 -right-1 w-3 h-3 border-b-2 border-r-2 border-emerald-400"></div>

                {/* Rayon laser animé */}
                <div className="absolute inset-x-2 h-0.5 bg-gradient-to-r from-transparent via-red-500 to-transparent shadow-[0_0_10px_rgba(239,68,68,1)] animate-scanner-laser pointer-events-none" />
              </div>
            )}
          </div>

          {/* Formulaire de saisie manuelle / douchette */}
          <form onSubmit={handleManualSubmit} className="w-full mt-3">
            <div className="flex items-center space-x-2 space-x-reverse">
              <div className="relative flex-1">
                <Barcode className="w-4 h-4 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  placeholder="أو أدخل الرمز يدوياً / Code manuel..."
                  disabled={isSuccess}
                  className="w-full pl-8 pr-2.5 py-1.5 text-xs bg-white border border-gray-300 rounded-lg focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 font-mono text-gray-900 placeholder:text-gray-400 disabled:bg-gray-100"
                  autoFocus
                />
              </div>
              <button
                type="submit"
                disabled={!manualCode.trim() || isSuccess}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400 text-white text-xs font-bold rounded-lg transition-colors shadow-sm"
              >
                تأكيد
              </button>
            </div>
          </form>

          {/* Indicateur de support matériel */}
          <div className="mt-2.5 flex items-center justify-center space-x-2 text-[10px] text-gray-400 font-medium">
            <span>يدعم douchette السكانر • الكاميرا • الإدخال السريع</span>
          </div>
        </div>
      </div>
    </div>
  );
};
