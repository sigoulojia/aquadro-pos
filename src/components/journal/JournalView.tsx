import React, { useState, useEffect } from 'react';
import { db } from '../../db/sqlite';
import { CurrencyUtil } from '../../core/currency/currency';
import {
  History,
  ShoppingCart,
  TrendingDown,
  RefreshCcw,
  Truck,
  CreditCard,
  Banknote,
  Search,
  Filter
} from 'lucide-react';

interface JournalEvent {
  id: string;
  date: string;
  type: 'SALE' | 'CREDIT_SALE' | 'PURCHASE' | 'EXPENSE' | 'REFUND' | 'PAYMENT_RECEIVED';
  title: string;
  description: string;
  amount: number;
  user: string;
  color: string;
  icon: React.ReactNode;
}

export const JournalView: React.FC = () => {
  const [events, setEvents] = useState<JournalEvent[]>([]);
  const [filteredEvents, setFilteredEvents] = useState<JournalEvent[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('ALL');

  useEffect(() => {
    loadJournal();
  }, []);

  useEffect(() => {
    let result = events;
    if (filterType !== 'ALL') {
      result = result.filter(e => e.type === filterType || (filterType === 'SALE' && e.type === 'CREDIT_SALE'));
    }
    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      result = result.filter(
        e => e.title.toLowerCase().includes(lower) || e.description.toLowerCase().includes(lower) || e.user.toLowerCase().includes(lower)
      );
    }
    setFilteredEvents(result);
  }, [events, searchTerm, filterType]);

  const loadJournal = async () => {
    const journal: JournalEvent[] = [];

    // 1. Sales & Credit Sales
    const sales = await db.select<any>('SELECT * FROM sales WHERE status = "COMPLETED"');
    const payments = await db.select<any>('SELECT * FROM payments');
    
    for (const sale of sales) {
      const salePayments = payments.filter(p => p.sale_id === sale.id);
      const isCredit = salePayments.some(p => p.payment_method === 'CREDIT');
      
      journal.push({
        id: sale.id,
        date: sale.created_at,
        type: isCredit ? 'CREDIT_SALE' : 'SALE',
        title: isCredit ? 'Vente à Crédit (Facilité)' : 'Vente',
        description: `Ticket: ${sale.receipt_number} | Client: ${sale.customer_name || 'Passager'}`,
        amount: sale.total_ttc,
        user: sale.cashier_name || 'Système',
        color: isCredit ? 'text-amber-600 bg-amber-50 border-amber-200' : 'text-emerald-600 bg-emerald-50 border-emerald-200',
        icon: <ShoppingCart className="w-4 h-4" />
      });
    }

    // 2. Purchases (Achats)
    const purchases = await db.select<any>('SELECT * FROM purchases');
    for (const p of purchases) {
      journal.push({
        id: p.id,
        date: p.ordered_at,
        type: 'PURCHASE',
        title: 'Achat Fournisseur',
        description: `Commande: ${p.order_number} | Fournisseur: ${p.supplier_name || '-'}`,
        amount: p.total_cost,
        user: 'Administrateur',
        color: 'text-blue-600 bg-blue-50 border-blue-200',
        icon: <Truck className="w-4 h-4" />
      });
    }

    // 3. Expenses (Dépenses)
    const expenses = await db.select<any>('SELECT * FROM expenses');
    for (const e of expenses) {
      journal.push({
        id: e.id,
        date: e.created_at || new Date(e.date).toISOString(),
        type: 'EXPENSE',
        title: 'Dépense Magasin',
        description: `Catégorie: ${e.category} | Motif: ${e.description}`,
        amount: e.amount,
        user: e.user_name || 'Système',
        color: 'text-red-600 bg-red-50 border-red-200',
        icon: <TrendingDown className="w-4 h-4" />
      });
    }

    // 4. Refunds (Remboursements)
    const refunds = await db.select<any>('SELECT * FROM refunds');
    for (const r of refunds) {
      journal.push({
        id: r.id,
        date: r.created_at,
        type: 'REFUND',
        title: 'Remboursement / Retour',
        description: `Ticket Origine: ${r.receipt_number} | Motif: ${r.reason}`,
        amount: r.refund_amount,
        user: r.cashier_name || 'Système',
        color: 'text-orange-600 bg-orange-50 border-orange-200',
        icon: <RefreshCcw className="w-4 h-4" />
      });
    }

    // 5. Customer Payments (Règlements Dettes)
    const custPayments = await db.select<any>('SELECT * FROM customer_payments');
    for (const cp of custPayments) {
      journal.push({
        id: cp.id,
        date: cp.created_at,
        type: 'PAYMENT_RECEIVED',
        title: 'Règlement de Dette Client',
        description: `Client: ${cp.customer_name || '-'} | Réf: ${cp.reference || '-'}`,
        amount: cp.amount,
        user: 'Système',
        color: 'text-purple-600 bg-purple-50 border-purple-200',
        icon: <CreditCard className="w-4 h-4" />
      });
    }

    // Sort descending by date
    journal.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    setEvents(journal);
  };

  return (
    <div className="flex-1 bg-gray-100 p-4 flex flex-col overflow-hidden text-xs select-none">
      {/* HEADER */}
      <div className="flex items-center justify-between pb-3">
        <div>
          <h2 className="text-base font-bold text-gray-900 flex items-center">
            <History className="w-5 h-5 mr-2 text-blue-600" />
            Journal Global d'Activité
          </h2>
          <span className="text-[11px] text-gray-500">
            Traçabilité complète et inaltérable de toutes les opérations du magasin (Ventes, Crédits, Achats, Dépenses).
          </span>
        </div>
        <div className="flex space-x-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-8 pr-3 py-1.5 rounded border border-gray-300 text-xs focus:outline-none focus:border-blue-500 w-48"
            />
          </div>
          <div className="relative">
            <Filter className="w-3.5 h-3.5 absolute left-2.5 top-2 text-gray-400" />
            <select
              value={filterType}
              onChange={e => setFilterType(e.target.value)}
              className="pl-8 pr-6 py-1.5 rounded border border-gray-300 text-xs focus:outline-none focus:border-blue-500 appearance-none bg-white"
            >
              <option value="ALL">Toutes les opérations</option>
              <option value="SALE">Ventes & Crédits</option>
              <option value="PURCHASE">Achats Fournisseurs</option>
              <option value="EXPENSE">Dépenses</option>
              <option value="REFUND">Remboursements</option>
              <option value="PAYMENT_RECEIVED">Règlements Clients</option>
            </select>
          </div>
          <button onClick={loadJournal} className="px-3 py-1.5 rounded bg-white border border-gray-300 hover:bg-gray-50 text-gray-700">
            Actualiser
          </button>
        </div>
      </div>

      {/* LISTE */}
      <div className="flex-1 bg-white border border-gray-200 rounded overflow-hidden flex flex-col">
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {filteredEvents.length === 0 ? (
            <div className="text-center py-10 text-gray-500">
              Aucune opération trouvée dans le journal.
            </div>
          ) : (
            <div className="relative border-l border-gray-200 ml-3 space-y-6">
              {filteredEvents.map(event => (
                <div key={event.id} className="relative pl-6">
                  {/* Timeline Dot */}
                  <div className={`absolute -left-3.5 top-1 w-7 h-7 rounded-full flex items-center justify-center border-2 bg-white ${event.color}`}>
                    {event.icon}
                  </div>
                  
                  {/* Content Card */}
                  <div className="bg-gray-50 border border-gray-100 rounded p-3 hover:shadow-sm transition-shadow">
                    <div className="flex justify-between items-start mb-1">
                      <div>
                        <span className="font-bold text-gray-900 text-sm">{event.title}</span>
                        <span className="mx-2 text-gray-300">|</span>
                        <span className="text-[11px] text-gray-500 font-mono">
                          {new Date(event.date).toLocaleString()}
                        </span>
                      </div>
                      <div className={`font-mono font-bold text-sm ${
                        event.type === 'EXPENSE' || event.type === 'PURCHASE' || event.type === 'REFUND' 
                          ? 'text-red-600' 
                          : 'text-emerald-600'
                      }`}>
                        {event.type === 'EXPENSE' || event.type === 'PURCHASE' || event.type === 'REFUND' ? '-' : '+'}
                        {CurrencyUtil.formatDZD(event.amount)}
                      </div>
                    </div>
                    <div className="text-gray-700 mt-1">{event.description}</div>
                    <div className="mt-2 text-[10px] text-gray-400 flex items-center">
                      <Banknote className="w-3 h-3 mr-1" />
                      Opérateur : <strong className="ml-1 text-gray-600">{event.user}</strong>
                      <span className="mx-2">•</span>
                      ID Traçabilité : <span className="font-mono">{event.id}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
