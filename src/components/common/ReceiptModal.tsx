// Aquadro POS Algérie V2 — Modal d'Aperçu & Impression du Ticket de Caisse
// Design sobre, blanc ERP, formatage ticket thermique 80mm/58mm et raccourcis clavier

import React, { useState, useEffect } from 'react';
import { printerService, ReceiptPrintData } from '../../services/printer.service';
import { CurrencyUtil } from '../../core/currency/currency';
import { useI18n } from '../../i18n';
import {
  Printer,
  CheckCircle,
  X,
  FileText,
  RotateCcw,
  SlidersHorizontal
} from 'lucide-react';

interface ReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  receiptData: ReceiptPrintData | null;
  onNewSale?: () => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
  isOpen,
  onClose,
  receiptData,
  onNewSale
}) => {
  const { t, language } = useI18n();
  const [paperWidth, setPaperWidth] = useState<'58mm' | '80mm'>('80mm');
  const [autoPrint, setAutoPrint] = useState<boolean>(true);

  useEffect(() => {
    const cfg = printerService.getConfig();
    setPaperWidth(cfg.paperWidth || '80mm');
    setAutoPrint(cfg.autoPrint !== false);
  }, [isOpen]);

  // Écoute clavier (Entrée pour imprimer, Échap pour nouvelle vente / fermer)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handlePrint();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        handleClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, receiptData, paperWidth]);

  if (!isOpen || !receiptData) return null;

  const currentReceiptWithWidth: ReceiptPrintData = {
    ...receiptData,
    paperWidth
  };

  const handlePrint = async () => {
    await printerService.printReceipt(currentReceiptWithWidth, true);
  };

  const handlePaperWidthChange = (width: '58mm' | '80mm') => {
    setPaperWidth(width);
    const cfg = printerService.getConfig();
    printerService.saveConfig({ ...cfg, paperWidth: width });
  };

  const handleAutoPrintToggle = (checked: boolean) => {
    setAutoPrint(checked);
    const cfg = printerService.getConfig();
    printerService.saveConfig({ ...cfg, autoPrint: checked });
  };

  const handleClose = () => {
    if (onNewSale) {
      onNewSale();
    } else {
      onClose();
    }
  };

  const isCash = receiptData.paymentMethod === 'CASH';
  const changeGiven = receiptData.changeGiven ?? 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 select-none animate-in fade-in duration-150">
      <div className="bg-white border border-gray-200 rounded-lg shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[92vh]">
        {/* ========================================================================= */}
        {/* EN-TÊTE MODAL                                                             */}
        {/* ========================================================================= */}
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            <div>
              <h3 className="font-bold text-gray-900 text-sm">
                {language === 'ar' ? 'تم تسجيل العملية بنجاح' : 'Vente Validée avec Succès'}
              </h3>
              <p className="text-[11px] text-gray-500 font-mono">
                {receiptData.receiptNumber} — {receiptData.dateTime}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-200 transition-colors"
            title="Fermer (Échap)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ========================================================================= */}
        {/* BANNIÈRE MONNAIE À RENDRE (SI PAIEMENT ESPÈCES)                           */}
        {/* ========================================================================= */}
        {isCash && (
          <div className="px-4 py-2.5 bg-emerald-50 border-b border-emerald-200 flex items-center justify-between">
            <div className="text-xs text-emerald-900 font-medium">
              <span>{language === 'ar' ? 'المبلغ المتبقي للزبون :' : 'Monnaie à rendre au client :'}</span>
              <div className="text-[10px] text-emerald-700">
                {language === 'ar' ? 'المقبوض: ' : 'Reçu: '}
                {CurrencyUtil.formatDZD(receiptData.tenderedAmount || 0)}
              </div>
            </div>
            <div className="text-xl font-bold font-mono text-emerald-700">
              {CurrencyUtil.formatDZD(changeGiven)}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* OPTIONS DE FORMAT & AUTO-PRINT                                            */}
        {/* ========================================================================= */}
        <div className="px-4 py-2 border-b border-gray-100 bg-gray-50/70 flex items-center justify-between text-xs">
          <div className="flex items-center space-x-1">
            <span className="text-[11px] text-gray-500 font-medium mr-1">
              {language === 'ar' ? 'عرض الورق:' : 'Format:'}
            </span>
            <button
              type="button"
              onClick={() => handlePaperWidthChange('80mm')}
              className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${
                paperWidth === '80mm'
                  ? 'bg-blue-600 border-blue-600 text-white'
                  : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-100'
              }`}
            >
              80 mm
            </button>
            <button
              type="button"
              onClick={() => handlePaperWidthChange('58mm')}
              className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${
                paperWidth === '58mm'
                  ? 'bg-blue-600 border-blue-600 text-white'
                  : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-100'
              }`}
            >
              58 mm
            </button>
          </div>

          <label className="flex items-center space-x-1.5 cursor-pointer text-[11px] text-gray-600 font-medium">
            <input
              type="checkbox"
              checked={autoPrint}
              onChange={e => handleAutoPrintToggle(e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span>{language === 'ar' ? 'طباعة تلقائية' : 'Impression auto'}</span>
          </label>
        </div>

        {/* ========================================================================= */}
        {/* VISUALISATION FIDÈLE DU TICKET THERMIQUE (REÇU)                           */}
        {/* ========================================================================= */}
        <div className="flex-1 overflow-y-auto p-4 bg-gray-100 flex justify-center">
          <div
            className={`bg-white border border-gray-300 shadow-sm p-3 transition-all ${
              paperWidth === '58mm' ? 'w-[58mm] min-w-[220px]' : 'w-[80mm] min-w-[310px]'
            }`}
            dangerouslySetInnerHTML={{
              __html: printerService.generateReceiptHtml(currentReceiptWithWidth)
            }}
          />
        </div>

        {/* ========================================================================= */}
        {/* PIED DE MODAL & ACTIONS                                                   */}
        {/* ========================================================================= */}
        <div className="p-3 border-t border-gray-200 bg-gray-50 flex items-center justify-between space-x-2">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 rounded bg-white hover:bg-gray-100 border border-gray-300 text-gray-700 font-semibold text-xs transition-colors flex items-center space-x-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{language === 'ar' ? 'بيع جديد (Échap)' : 'Nouvelle Vente (Échap)'}</span>
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="flex-1 py-2 px-4 rounded bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-colors shadow-sm flex items-center justify-center space-x-1.5"
          >
            <Printer className="w-4 h-4" />
            <span>{language === 'ar' ? 'طباعة التذكرة (Entrée)' : 'Imprimer le Ticket (Entrée)'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
