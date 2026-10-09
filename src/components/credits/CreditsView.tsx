import React, { useState, useEffect } from 'react';
import { db } from '../../db/sqlite';
import { customerService } from '../../services/customer.service';
import { useAuth } from '../../hooks/useAuth';
import { CurrencyUtil } from '../../core/currency/currency';
import { useToast } from '../common/Toast';
import {
  CreditCard,
  Search,
  CheckCircle,
  Clock,
  User,
  FileText,
  DollarSign
} from 'lucide-react';

interface CreditSaleInfo {
  saleId: string;
  receiptNumber: string;
  date: string;
  customerId: string;
  customerName: string;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
}

export const CreditsView: React.FC = () => {
  const { user } = useAuth();
  const { showToast } = useToast();
  
  const [credits, setCredits] = useState<CreditSaleInfo[]>([]);
  const [filteredCredits, setFilteredCredits] = useState<CreditSaleInfo[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [selectedCredit, setSelectedCredit] = useState<CreditSaleInfo | null>(null);
  const [payAmount, setPayAmount] = useState<string>('');

  useEffect(() => {
    loadCredits();
  }, []);

  useEffect(() => {
    if (!searchTerm) {
      setFilteredCredits(credits);
    } else {
      const lower = searchTerm.toLowerCase();
      setFilteredCredits(
        credits.filter(c => 
          c.receiptNumber.toLowerCase().includes(lower) || 
          c.customerName.toLowerCase().includes(lower)
        )
      );
    }
  }, [searchTerm, credits]);

  const loadCredits = async () => {
    // 1. Get all payments that are CREDIT
    const allPayments = await db.select<any>('SELECT * FROM payments WHERE payment_method = "CREDIT"');
    if (allPayments.length === 0) {
      setCredits([]);
      return;
    }
    
    // 2. Get associated sales
    const saleIds = [...new Set(allPayments.map(p => p.sale_id))];
    const placeholders = saleIds.map(() => '?').join(',');
    const sales = await db.select<any>(
      `SELECT * FROM sales WHERE status = "COMPLETED" AND id IN (${placeholders})`,
      saleIds
    );

    // 3. Get all customer payments (to check how much was paid back for each receipt)
    const custPayments = await db.select<any>('SELECT * FROM customer_payments');

    const creditsInfo: CreditSaleInfo[] = [];

    for (const sale of sales) {
      if (!sale.customer_id) continue;
      
      const saleCreditPayments = allPayments.filter(p => p.sale_id === sale.id);
      const totalCreditForSale = saleCreditPayments.reduce((sum, p) => sum + p.amount, 0);
      
      const salePaymentsMade = custPayments.filter(cp => cp.reference === sale.receipt_number);
      const totalPaidBack = salePaymentsMade.reduce((sum, cp) => sum + cp.amount, 0);
      
      const remaining = totalCreditForSale - totalPaidBack;

      if (remaining > 0.01) { // Floating point precision check
        creditsInfo.push({
          saleId: sale.id,
          receiptNumber: sale.receipt_number,
          date: sale.created_at,
          customerId: sale.customer_id,
          customerName: sale.customer_name || 'Inconnu',
          totalAmount: totalCreditForSale,
          paidAmount: totalPaidBack,
          remainingAmount: remaining
        });
      }
    }

    creditsInfo.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    setCredits(creditsInfo);
  };

  const handlePay = async () => {
    if (!selectedCredit || !user) return;
    const amount = parseFloat(payAmount);
    
    if (isNaN(amount) || amount <= 0) {
      showToast('Veuillez entrer un montant valide', 'error');
      return;
    }
    
    if (amount > selectedCredit.remainingAmount) {
      showToast('Le montant saisi est supérieur au reste à payer', 'error');
      return;
    }

    try {
      await customerService.recordCreditPayment({
        customerId: selectedCredit.customerId,
        amount: amount,
        paymentMethod: 'CASH', // Usually cash when they come back to pay
        cashierId: user.id,
        reference: selectedCredit.receiptNumber // IMPORTANT: This links the payment to the bon
      });

      showToast('Paiement enregistré avec succès. Le crédit a été mis à jour.', 'success');
      setSelectedCredit(null);
      setPayAmount('');
      loadCredits();
    } catch (error: any) {
      showToast(error.message || 'Erreur lors du paiement', 'error');
    }
  };

  const openPaymentModal = (credit: CreditSaleInfo) => {
    setSelectedCredit(credit);
    setPayAmount(credit.remainingAmount.toString());
  };

  return (
    <div className="flex-1 bg-gray-100 p-4 flex flex-col overflow-hidden text-xs select-none">
      <div className="flex items-center justify-between pb-3 border-b border-gray-200 mb-4">
        <div>
          <h2 className="text-base font-bold text-gray-900 flex items-center">
            <CreditCard className="w-5 h-5 mr-2 text-amber-600" />
            Gestion des Crédits (Facilités)
          </h2>
          <span className="text-[11px] text-gray-500">
            Recherchez un "Bon de Crédit" par son numéro pour enregistrer son paiement. Les bons payés disparaîtront de cette liste.
          </span>
        </div>
        <div className="relative">
          <Search className="w-4 h-4 absolute left-2.5 top-2 text-gray-400" />
          <input
            type="text"
            placeholder="Recherche Bon ou Client..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="pl-8 pr-3 py-1.5 rounded border border-gray-300 text-xs focus:outline-none focus:border-amber-500 w-64"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 overflow-y-auto">
        {filteredCredits.length === 0 ? (
          <div className="col-span-full py-10 text-center text-gray-500 text-sm bg-white rounded border border-gray-200">
            Aucun crédit en attente trouvé. Tous les bons sont payés.
          </div>
        ) : (
          filteredCredits.map(credit => (
            <div key={credit.receiptNumber} className="bg-white rounded border border-gray-200 shadow-sm overflow-hidden flex flex-col">
              <div className="bg-amber-50 border-b border-amber-100 p-3 flex justify-between items-center">
                <div className="font-mono font-bold text-amber-800 text-sm flex items-center">
                  <FileText className="w-4 h-4 mr-1.5" />
                  {credit.receiptNumber}
                </div>
                <div className="text-[10px] text-amber-600 flex items-center">
                  <Clock className="w-3 h-3 mr-1" />
                  {new Date(credit.date).toLocaleDateString()}
                </div>
              </div>
              
              <div className="p-4 flex-1 flex flex-col">
                <div className="flex items-center text-sm font-semibold text-gray-800 mb-4">
                  <User className="w-4 h-4 mr-2 text-gray-500" />
                  {credit.customerName}
                </div>
                
                <div className="space-y-2 mb-4 flex-1">
                  <div className="flex justify-between text-gray-600">
                    <span>Total du Bon:</span>
                    <span>{CurrencyUtil.formatDZD(credit.totalAmount)}</span>
                  </div>
                  <div className="flex justify-between text-emerald-600">
                    <span>Déjà payé:</span>
                    <span>{CurrencyUtil.formatDZD(credit.paidAmount)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-red-600 text-sm pt-2 border-t border-gray-100">
                    <span>Reste à Payer:</span>
                    <span>{CurrencyUtil.formatDZD(credit.remainingAmount)}</span>
                  </div>
                </div>

                <button 
                  onClick={() => openPaymentModal(credit)}
                  className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold py-2 rounded flex items-center justify-center transition-colors"
                >
                  <DollarSign className="w-4 h-4 mr-2" />
                  Payer ce Bon
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal Paiement */}
      {selectedCredit && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-gray-800">Règlement du Crédit</h3>
              <button onClick={() => setSelectedCredit(null)} className="text-gray-500 hover:text-red-500 text-xl font-bold">&times;</button>
            </div>
            
            <div className="p-4">
              <div className="mb-4 bg-amber-50 p-3 rounded text-amber-900 text-center">
                <div className="text-[10px] uppercase mb-1">Reste à payer</div>
                <div className="font-bold text-xl">{CurrencyUtil.formatDZD(selectedCredit.remainingAmount)}</div>
              </div>

              <div className="mb-4">
                <label className="block text-[11px] font-bold text-gray-700 uppercase mb-1">
                  Montant payé par le client (DZD)
                </label>
                <input
                  type="number"
                  autoFocus
                  value={payAmount}
                  onChange={e => setPayAmount(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded text-sm text-center font-bold focus:border-amber-500 focus:outline-none"
                />
              </div>

              <button
                onClick={handlePay}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-2 rounded font-bold flex items-center justify-center"
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                Valider le Paiement
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
