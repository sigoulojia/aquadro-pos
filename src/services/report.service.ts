// Aquadro POS Algérie V2 — Service de Reporting Financier & Métriques Opérationnelles
// Calculs rigoureux basés sur les données réelles de la base SQLite et export CSV

import { db } from '../db/sqlite';
import { Sale, SaleItem, Payment, Expense, Product } from '../types/database';
import { CurrencyUtil } from '../core/currency/currency';

export interface FinancialMetrics {
  revenue: number;           // Chiffre d'affaires TTC
  cogs: number;              // Coût des marchandises vendues (basé sur le snapshot historique)
  grossMargin: number;       // Marge brute (Revenue - COGS)
  marginPercentage: number;  // Taux de marge (%)
  expenses: number;          // Total des charges magasin
  netResult: number;         // Résultat net d'exploitation
  transactionCount: number;  // Nombre de ventes
  averageBasket: number;     // Panier moyen en DZD
  paymentBreakdown: {
    cash: number;
    cib_edahabia: number;
    baridimob: number;
    credit: number;
  };
  topProducts: {
    id: string;
    name: string;
    quantity: number;
    revenue: number;
  }[];
  debts: {
    customerTotalDebt: number;
    supplierTotalDebt: number;
  };
  purchases: {
    totalPurchasesCost: number;
  };
}

export interface InventoryValuation {
  totalItems: number;
  totalUnitsInStock: number;
  valuationAtCost: number;   // Valeur au coût d'achat en DZD
  valuationAtRetail: number; // Valeur au prix de vente TTC en DZD
  potentialGrossMargin: number;
}

export class ReportService {
  private static instance: ReportService;

  private constructor() {}

  public static getInstance(): ReportService {
    if (!ReportService.instance) {
      ReportService.instance = new ReportService();
    }
    return ReportService.instance;
  }

  // Calcul des métriques financières sur une période donnée (ou aujourd'hui)
  public async getFinancialMetrics(dateStr?: string): Promise<FinancialMetrics> {
    const today = dateStr || new Date().toISOString().split('T')[0];
    const allSales = await db.select<Sale>('SELECT * FROM sales WHERE status != \'CANCELLED\'');
    const todaySales = allSales.filter(s => s.created_at.startsWith(today));

    const allSaleItems = await db.select<SaleItem>('SELECT * FROM sale_items');
    const allPayments = await db.select<Payment>('SELECT * FROM payments');
    const allExpenses = await db.select<Expense>('SELECT * FROM expenses');
    const todayExpenses = allExpenses.filter(e => e.date === today);

    let revenue = 0;
    let cogs = 0;
    const saleIds = new Set(todaySales.map(s => s.id));

    for (const sale of todaySales) {
      revenue = CurrencyUtil.add(revenue, sale.total_ttc);
    }

    const productSalesMap = new Map<string, { name: string; quantity: number; revenue: number }>();
    const allProducts = await db.select<Product>('SELECT * FROM products');
    const productMap = new Map(allProducts.map(p => [p.id, p.name_fr]));
    
    // Nouveaux calculs pour Dettes et Achats
    const customers = await db.select<{current_debt: number}>('SELECT current_debt FROM customers');
    const customerTotalDebt = customers.reduce((sum, c) => sum + (c.current_debt || 0), 0);
    
    const suppliers = await db.select<{current_balance: number}>('SELECT current_balance FROM suppliers');
    const supplierTotalDebt = suppliers.reduce((sum, s) => sum + (s.current_balance || 0), 0);
    
    const allPurchases = await db.select<{total_cost: number, ordered_at: string}>('SELECT total_cost, ordered_at FROM purchases');
    const todayPurchases = allPurchases.filter(p => p.ordered_at && p.ordered_at.startsWith(today));
    const totalPurchasesCost = todayPurchases.reduce((sum, p) => sum + (p.total_cost || 0), 0);

    for (const item of allSaleItems) {
      if (saleIds.has(item.sale_id)) {
        // Coût d'achat historique figé * quantité
        const lineCost = CurrencyUtil.multiply(item.unit_purchase_cost_snapshot, item.quantity);
        cogs = CurrencyUtil.add(cogs, lineCost);
        
        // Accumuler les ventes par produit
        const existing = productSalesMap.get(item.product_id) || { name: productMap.get(item.product_id) || 'Produit Inconnu', quantity: 0, revenue: 0 };
        existing.quantity += item.quantity;
        existing.revenue = CurrencyUtil.add(existing.revenue, item.total_ttc);
        productSalesMap.set(item.product_id, existing);
      }
    }
    
    const topProducts = Array.from(productSalesMap.entries())
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10); // Top 10

    let expenses = 0;
    for (const exp of todayExpenses) {
      expenses = CurrencyUtil.add(expenses, exp.amount);
    }

    const grossMargin = CurrencyUtil.subtract(revenue, cogs);
    const netResult = CurrencyUtil.subtract(grossMargin, expenses);
    const marginPercentage = revenue > 0 ? (grossMargin / revenue) * 100 : 0;
    const transactionCount = todaySales.length;
    const averageBasket = transactionCount > 0 ? Math.round(revenue / transactionCount) : 0;

    // Répartition des règlements
    let cash = 0;
    let cib_edahabia = 0;
    let baridimob = 0;
    let credit = 0;

    for (const p of allPayments) {
      if (saleIds.has(p.sale_id)) {
        if (p.payment_method === 'CASH') cash = CurrencyUtil.add(cash, p.amount);
        else if (p.payment_method === 'CIB' || p.payment_method === 'EDAHABIA') cib_edahabia = CurrencyUtil.add(cib_edahabia, p.amount);
        else if (p.payment_method === 'BARIDIMOB') baridimob = CurrencyUtil.add(baridimob, p.amount);
        else if (p.payment_method === 'CREDIT') credit = CurrencyUtil.add(credit, p.amount);
      }
    }

    return {
      revenue,
      cogs,
      grossMargin,
      marginPercentage: Math.round(marginPercentage * 10) / 10,
      expenses,
      netResult,
      transactionCount,
      averageBasket,
      paymentBreakdown: {
        cash,
        cib_edahabia,
        baridimob,
        credit
      },
      topProducts,
      debts: {
        customerTotalDebt,
        supplierTotalDebt
      },
      purchases: {
        totalPurchasesCost
      }
    };
  }

  // Valorisation de l'actif stock en DZD
  public async getInventoryValuation(): Promise<InventoryValuation> {
    const products = await db.select<Product>('SELECT * FROM products WHERE is_active = 1');
    let totalUnits = 0;
    let valuationCost = 0;
    let valuationRetail = 0;

    for (const p of products) {
      if (p.current_stock > 0) {
        totalUnits += p.current_stock;
        valuationCost = CurrencyUtil.add(valuationCost, CurrencyUtil.multiply(p.purchase_cost, p.current_stock));
        valuationRetail = CurrencyUtil.add(valuationRetail, CurrencyUtil.multiply(p.selling_price_ttc, p.current_stock));
      }
    }

    return {
      totalItems: products.length,
      totalUnitsInStock: totalUnits,
      valuationAtCost: valuationCost,
      valuationAtRetail: valuationRetail,
      potentialGrossMargin: CurrencyUtil.subtract(valuationRetail, valuationCost)
    };
  }

  // Export CSV universel des données
  public exportToCsv(filename: string, headers: string[], rows: any[][]): void {
    const csvContent = [
      headers.join(';'),
      ...rows.map(r => r.map(val => `"${String(val ?? '').replace(/"/g, '""')}"`).join(';'))
    ].join('\r\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}

export const reportService = ReportService.getInstance();
