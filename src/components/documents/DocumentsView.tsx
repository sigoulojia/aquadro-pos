// Aquadro POS Algérie V2 — Gestion des Documents Commerciaux
// Suivi et consultation des Factures, Tickets, Avoirs et Bons avec numérotation séquentielle inviolable

import React, { useState, useEffect } from 'react';
import { documentService } from '../../services/document.service';
import { DocumentRecord, DocumentType } from '../../types/database';
import { CurrencyUtil } from '../../core/currency/currency';
import {
  FileText,
  Search,
  Printer,
  Eye,
  Filter,
  CheckCircle2
} from 'lucide-react';

export const DocumentsView: React.FC = () => {
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [search, setSearch] = useState<string>('');

  useEffect(() => {
    loadDocuments();
  }, [selectedType]);

  const loadDocuments = async () => {
    const typeParam = selectedType === 'ALL' ? undefined : (selectedType as DocumentType);
    const list = await documentService.getDocuments(typeParam, 100);
    setDocuments(list);
  };

  const filtered = documents.filter(d => {
    if (!search.trim()) return true;
    const q = search.toLowerCase().trim();
    return (
      d.document_number.toLowerCase().includes(q) ||
      d.reference_id.toLowerCase().includes(q) ||
      (d.customer_or_supplier_name && d.customer_or_supplier_name.toLowerCase().includes(q))
    );
  });

  return (
    <div className="flex-1 bg-gray-100 p-4 flex flex-col overflow-hidden text-xs select-none">
      {/* Barre d'outils supérieure */}
      <div className="flex items-center justify-between pb-3">
        <div>
          <h2 className="text-base font-bold text-gray-900">Documents Commerciaux & Factures</h2>
          <span className="text-[11px] text-gray-500">
            Séquences officielles immuables (Factures, Tickets, Avoirs, Bons)
          </span>
        </div>
      </div>

      {/* Barre de Recherche et Filtres par type */}
      <div className="bg-white p-2.5 rounded-t border border-gray-200 border-b-0 flex items-center space-x-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Rechercher par N° document, référence, tiers..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-gray-50 border border-gray-300 rounded pl-8 pr-3 py-1.5 text-xs text-gray-900 focus:outline-none focus:border-blue-600"
          />
        </div>

        <div className="flex items-center space-x-1">
          <span className="text-gray-500 text-[11px]">Type de document :</span>
          <select
            value={selectedType}
            onChange={e => setSelectedType(e.target.value)}
            className="bg-gray-50 border border-gray-300 rounded px-2 py-1.5 text-xs text-gray-800 focus:outline-none"
          >
            <option value="ALL">Tous les documents</option>
            <option value="TICKET">Tickets de Caisse (TKT)</option>
            <option value="FACTURE">Factures Commerciales (FAC)</option>
            <option value="AVOIR">Avoirs & Retours (AVO)</option>
            <option value="BON_LIVRAISON">Bons de Livraison (BL)</option>
            <option value="COMMANDE">Bons de Commande (BC)</option>
          </select>
        </div>
      </div>

      {/* Tableau des Documents */}
      <div className="flex-1 bg-white border border-gray-200 rounded-b overflow-hidden flex flex-col">
        <div className="flex-1 overflow-y-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 text-[11px] sticky top-0">
              <tr>
                <th className="py-2.5 px-3 font-semibold">Type</th>
                <th className="py-2.5 px-3 font-semibold">Numéro Document</th>
                <th className="py-2.5 px-3 font-semibold">Réf. Interne</th>
                <th className="py-2.5 px-3 font-semibold">Client / Fournisseur</th>
                <th className="py-2.5 px-3 font-semibold">Date d'Émission</th>
                <th className="py-2.5 px-3 font-semibold text-right">Montant Total TTC</th>
                <th className="py-2.5 px-3 font-semibold text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-gray-400">
                    Aucun document trouvé.
                  </td>
                </tr>
              ) : (
                filtered.map(d => (
                  <tr key={d.id} className="hover:bg-gray-50">
                    <td className="py-2 px-3">
                      <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-blue-50 text-blue-700 border border-blue-200">
                        {d.document_type}
                      </span>
                    </td>
                    <td className="py-2 px-3 font-mono font-bold text-gray-900">{d.document_number}</td>
                    <td className="py-2 px-3 font-mono text-gray-500 text-[11px]">{d.reference_id}</td>
                    <td className="py-2 px-3 text-gray-800">{d.customer_or_supplier_name || 'Comptoir'}</td>
                    <td className="py-2 px-3 font-mono text-gray-500 text-[11px]">
                      {new Date(d.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-2 px-3 text-right font-mono font-bold text-gray-900">
                      {CurrencyUtil.formatDZD(d.total_ttc)}
                    </td>
                    <td className="py-2 px-3 text-center">
                      <button
                        onClick={() => window.print()}
                        className="p-1 hover:bg-gray-100 rounded text-gray-600 hover:text-blue-600"
                        title="Imprimer le document"
                      >
                        <Printer className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
