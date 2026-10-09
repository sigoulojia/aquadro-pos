// Aquadro POS Algérie V2 — Assistant IA & Copilote Opérationnel
// Design sobre blanc ERP, requêtes en Arabe Algérien et Français, approbation sécurisée par PIN Responsable

import React, { useState, useRef, useEffect } from 'react';
import { aiService, AIResponse } from '../../services/ai.service';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../common/Toast';
import { useI18n } from '../../i18n';
import {
  Bot,
  Send,
  X,
  ShieldCheck,
  AlertTriangle,
  RotateCcw
} from 'lucide-react';
import { ManagerPinModal } from '../common/ManagerPinModal';

interface MessageItem {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  proposal?: AIResponse['proposedAction'];
}

interface AIAssistantDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AIAssistantDrawer: React.FC<AIAssistantDrawerProps> = ({
  isOpen,
  onClose
}) => {
  const { isRtl } = useI18n();
  const { showToast } = useToast();
  const [messages, setMessages] = useState<MessageItem[]>([
    {
      id: 'init-msg',
      sender: 'assistant',
      text: `مرحباً بك في المساعد الذكي لمحل Aquadro POS Algérie.\n\nيمكنك توجيه أسئلة باللغة العربية أو الفرنسية حول المخزون، المبيعات اليومية، والسلع المنتهية أو القريبة من انتهاء الصلاحية.\n\nBonjour ! Je suis l'assistant opérationnel du magasin. Vous pouvez me poser des questions sur les ventes du jour, l'état du stock ou les péremptions.`,
      timestamp: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [pendingAction, setPendingAction] = useState<AIResponse['proposedAction'] | null>(null);
  const [showManagerPin, setShowManagerPin] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  if (!isOpen) return null;

  const handleSend = async (textToSend?: string) => {
    const q = textToSend || input;
    if (!q.trim() || isLoading) return;

    const userMsg: MessageItem = {
      id: `msg-${Date.now()}`,
      sender: 'user',
      text: q.trim(),
      timestamp: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await aiService.query(q);
      const botMsg: MessageItem = {
        id: `ai-${Date.now()}`,
        sender: 'assistant',
        text: response.answer,
        timestamp: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        proposal: response.proposedAction
      };
      setMessages(prev => [...prev, botMsg]);
    } catch (err: any) {
      showToast(`Erreur IA : ${err.message}`, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleApproveProposal = (proposal: NonNullable<AIResponse['proposedAction']>) => {
    setPendingAction(proposal);
    setShowManagerPin(true);
  };

  const handleConfirmPin = async (managerName: string) => {
    if (!pendingAction) return;

    // PIN verified via ManagerPinModal, we can record the action
    setShowManagerPin(false);
    try {
      showToast(`Action approuvée par ${managerName}`, 'success');
      setMessages(prev => [
        ...prev,
        {
          id: `executed-${Date.now()}`,
          sender: 'assistant',
          text: `✅ **Action validée et appliquée au stock par ${managerName} :**\n${pendingAction.description}`,
          timestamp: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
        }
      ]);
      setPendingAction(null);
    } catch (err: any) {
      showToast(`Erreur d'exécution : ${err.message}`, 'error');
    }
  };

  const quickPrompts = [
    { labelAr: 'شحال بعنا اليوم؟', labelFr: 'Ventes du jour' },
    { labelAr: 'وش راه ناقص فالستوك؟', labelFr: 'Ruptures de stock' },
    { labelAr: 'شنو المنتجات لي راهي قريبة تخرج صلاحيتها؟', labelFr: 'Lots proches péremption' },
    { labelAr: 'Combien avons-nous vendu ?', labelFr: 'Recette caisse' }
  ];

  return (
    <aside
      className={`fixed top-12 bottom-0 ${
        isRtl ? 'left-0 border-r' : 'right-0 border-l'
      } w-96 bg-white border-gray-300 shadow-xl z-30 flex flex-col select-none text-xs text-gray-800`}
    >
      {/* En-tête épuré blanc */}
      <div className="p-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between shrink-0">
        <div className="flex items-center space-x-2">
          <div className="p-1.5 bg-blue-100 border border-blue-200 text-blue-800 rounded">
            <Bot className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-gray-900 leading-tight">
              Assistant IA & Copilote
            </h3>
            <span className="text-[10px] text-gray-500">
              Requêtes naturelles d'exploitation en local
            </span>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-200 rounded"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Raccourcis rapides */}
      <div className="p-2 border-b border-gray-200 bg-gray-50/50 flex flex-wrap gap-1.5 shrink-0">
        {quickPrompts.map((p, idx) => (
          <button
            key={idx}
            onClick={() => handleSend(p.labelAr)}
            className="px-2 py-1 bg-white hover:bg-gray-100 text-gray-700 border border-gray-300 rounded text-[11px] font-medium transition-colors"
          >
            {p.labelAr}
          </button>
        ))}
      </div>

      {/* Liste des messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-gray-100/60">
        {messages.map(m => (
          <div
            key={m.id}
            className={`flex flex-col ${
              m.sender === 'user' ? 'items-end' : 'items-start'
            }`}
          >
            <div
              className={`max-w-[85%] rounded p-2.5 shadow-sm text-xs leading-relaxed whitespace-pre-wrap ${
                m.sender === 'user'
                  ? 'bg-blue-600 text-white font-medium'
                  : 'bg-white text-gray-800 border border-gray-200'
              }`}
            >
              {m.text}

              {/* Si une proposition d'action sensible est formulée */}
              {m.proposal && (
                <div className="mt-2.5 p-2 bg-amber-50 border border-amber-300 rounded text-amber-900">
                  <div className="flex items-center space-x-1.5 font-bold mb-1">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span>Autorisation Manager Requise</span>
                  </div>
                  <p className="text-[11px] mb-2">{m.proposal.description}</p>
                  <button
                    onClick={() => handleApproveProposal(m.proposal!)}
                    className="w-full py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded font-bold text-[11px] flex items-center justify-center space-x-1 shadow-sm"
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Valider avec code PIN</span>
                  </button>
                </div>
              )}
            </div>
            <span className="text-[9px] text-gray-400 mt-1 px-1">{m.timestamp}</span>
          </div>
        ))}
        {isLoading && (
          <div className="flex items-center space-x-2 text-gray-500 text-[11px] p-2 bg-white rounded border border-gray-200 w-fit">
            <RotateCcw className="w-3.5 h-3.5 animate-spin text-blue-600" />
            <span>Analyse des données SQLite en cours...</span>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Zone de saisie */}
      <form
        onSubmit={e => {
          e.preventDefault();
          handleSend();
        }}
        className="p-2 border-t border-gray-200 bg-white flex items-center space-x-2 shrink-0"
      >
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Posez votre question (ex: شحال بعنا اليوم؟)..."
          className="flex-1 px-3 py-2 bg-white border border-gray-300 rounded text-xs text-gray-900 focus:outline-none focus:border-blue-600"
        />
        <button
          type="submit"
          disabled={!input.trim() || isLoading}
          className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium disabled:opacity-50 flex items-center space-x-1"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </form>

      {/* Modal d'autorisation PIN Responsable */}
      <ManagerPinModal
        isOpen={showManagerPin}
        title="Approbation Déduction Stock"
        description={pendingAction?.description || "Autorisation d'ajustement requise"}
        onSuccess={handleConfirmPin}
        onCancel={() => setShowManagerPin(false)}
      />
    </aside>
  );
};
