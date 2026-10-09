// Aquadro POS Algérie V2 — Moteur d'Allocation FEFO (First Expired, First Out)
// Spécifique pour les compléments alimentaires (Protéines, Vitamines, Créatines).

export interface BatchCandidate {
  id: string;
  batch_number: string;
  expiration_date: string; // YYYY-MM-DD
  current_stock: number;
  purchase_cost: number;
}

export interface FefoAllocationItem {
  batchId: string;
  batchNumber: string;
  expirationDate: string;
  quantityAllocated: number;
  unitPurchaseCost: number; // Snapshot immuable du coût d'achat
}

export interface FefoAllocationResult {
  allocations: FefoAllocationItem[];
  totalAllocated: number;
  remainingRequested: number;
}

export class FefoEngine {
  // Alloue le stock en respectant rigoureusement la règle FEFO
  public static allocateStock(
    batches: BatchCandidate[],
    requestedQty: number,
    referenceDate: string = new Date().toISOString().split('T')[0]
  ): FefoAllocationResult {
    if (requestedQty <= 0) {
      return { allocations: [], totalAllocated: 0, remainingRequested: 0 };
    }

    // 1. Détecter si des lots sont périmés
    const expiredBatches = batches.filter(b => b.expiration_date < referenceDate && b.current_stock > 0);
    const validBatches = batches.filter(b => b.expiration_date >= referenceDate && b.current_stock > 0);

    // 2. Trier les lots valides du plus proche de la péremption au plus lointain
    const sortedValid = [...validBatches].sort((a, b) => a.expiration_date.localeCompare(b.expiration_date));

    // Calcul du stock valide disponible
    const totalValidStock = sortedValid.reduce((sum, b) => sum + b.current_stock, 0);

    if (totalValidStock < requestedQty) {
      if (expiredBatches.length > 0) {
        throw new Error(
          `Vente impossible : Le stock disponible (${totalValidStock} unité(s)) est insuffisant. ` +
          `Attention : ${expiredBatches.reduce((s, b) => s + b.current_stock, 0)} unité(s) appartiennent à des lots périmés ` +
          `(ex: Lot ${expiredBatches[0].batch_number} expiré le ${expiredBatches[0].expiration_date}). Vente interdite par la réglementation sanitaire.`
        );
      }
      throw new Error(`Stock insuffisant : ${totalValidStock} disponible(s), ${requestedQty} demandée(s).`);
    }

    const allocations: FefoAllocationItem[] = [];
    let needed = requestedQty;

    for (const batch of sortedValid) {
      if (needed <= 0) break;

      const take = Math.min(batch.current_stock, needed);
      allocations.push({
        batchId: batch.id,
        batchNumber: batch.batch_number,
        expirationDate: batch.expiration_date,
        quantityAllocated: take,
        unitPurchaseCost: batch.purchase_cost
      });

      needed -= take;
    }

    return {
      allocations,
      totalAllocated: requestedQty - needed,
      remainingRequested: needed
    };
  }

  // Vérifie si un lot individuel est expiré
  public static isExpired(expirationDate: string, referenceDate: string = new Date().toISOString().split('T')[0]): boolean {
    return expirationDate < referenceDate;
  }

  // Vérifie si un lot arrive à péremption imminente (ex: dans moins de N jours)
  public static isExpiringSoon(expirationDate: string, daysThreshold: number = 60): boolean {
    const today = new Date();
    const exp = new Date(expirationDate);
    const diffTime = exp.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays <= daysThreshold;
  }
}
