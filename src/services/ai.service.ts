// Aquadro POS Algérie V2 — Service Copilote IA Opérationnel
// Comprend les requêtes en Arabe Algérien et Français. Zéro SQL arbitraire. Protocole sécurisé par PIN Responsable.

import { db } from '../db/sqlite';
import { reportService } from './report.service';
import { inventoryService } from './inventory.service';
import { authService } from './auth.service';
import { CurrencyUtil } from '../core/currency/currency';
import { Product } from '../types/database';

export interface AIResponse {
  answer: string;
  proposedAction?: {
    type: 'STOCK_WRITE_OFF';
    productId: string;
    productName: string;
    quantity: number;
    reason: string;
    description: string;
  };
}

export class AIService {
  private static instance: AIService;

  private constructor() {}

  public static getInstance(): AIService {
    if (!AIService.instance) {
      AIService.instance = new AIService();
    }
    return AIService.instance;
  }

  // Traiter une requête naturelle de l'utilisateur
  public async query(prompt: string): Promise<AIResponse> {
    const q = prompt.toLowerCase().trim();
    const isAr = /[\u0600-\u06FF]/.test(prompt);

    // 1. Détection d'une demande d'ajustement de stock (Mise au rebut / Déduction)
    const writeOffMatch = q.match(/(?:déduire|supprimer|retirer|écrire|خصم|إنقاص|حذف|تالف|إتلاف)\s+(\d+)\s*(?:boîtes|pots|unités|قطعة|علبة)?\s*(?:de\s+)?(.+?)(?:\s+(?:car|parce que|pour|بسبب|بسبب انتهاء|منتهي|périmé|avarié|cassé))?$/i);
    if (writeOffMatch) {
      const qty = parseInt(writeOffMatch[1], 10);
      const queryName = writeOffMatch[2].trim();
      const products = await db.select<Product>('SELECT * FROM products WHERE is_active = 1');
      const target = products.find(p =>
        p.name_fr.toLowerCase().includes(queryName.toLowerCase()) ||
        p.name_ar.toLowerCase().includes(queryName.toLowerCase())
      );

      if (target) {
        return {
          answer: isAr
            ? `لقد عثرت على المنتج **${target.name_ar || target.name_fr}** (المخزون الحالي: ${target.current_stock} قطعة).\n\nقمت بإعداد مقترح رسمي لخصم **${qty} قطعة** بسبب التلف أو انتهاء الصلاحية. نظراً لأن هذا الإجراء يغير السجلات المحاسبية والمخزون، يرجى تأكيده برمز PIN للمسؤول أدناه :`
            : `J'ai trouvé l'article **${target.name_fr}** (Stock actuel : ${target.current_stock} unités).\n\nJ'ai préparé une proposition formelle pour déduire **${qty} unités**. Veuillez valider ci-dessous avec le code PIN Responsable :`,
          proposedAction: {
            type: 'STOCK_WRITE_OFF',
            productId: target.id,
            productName: target.name_fr,
            quantity: qty,
            reason: 'EXPIRY_OR_DAMAGE',
            description: `Mise au rebut de ${qty}x ${target.name_fr} (Autorisation Manager requise)`
          }
        };
      }
    }

    // 2. Chiffre d'Affaires & Ventes du jour ("شحال بعنا اليوم؟" / "Combien avons-nous vendu ?")
    if (q.includes('شحال بعنا') || q.includes('كم بعنا') || q.includes('vendu') || q.includes('chiffre') || q.includes('مبيعات اليوم') || q.includes('recette')) {
      const metrics = await reportService.getFinancialMetrics();
      const answer = isAr
        ? `📊 **ملخص مداخيل ومبيعات اليوم :**\n` +
          `- **إجمالي رقم الأعمال (Chiffre d'Affaires) :** ${CurrencyUtil.formatDZDAr(metrics.revenue)}\n` +
          `- **عدد المعاملات المنفذة :** ${metrics.transactionCount} عملية بيع\n` +
          `- **هامش الربح الإجمالي المحقق :** ${CurrencyUtil.formatDZDAr(metrics.grossMargin)} (${metrics.marginPercentage}%)\n` +
          `- **متوسط السلة (Panier Moyen) :** ${CurrencyUtil.formatDZDAr(metrics.averageBasket)}\n` +
          `- **تفصيل طرق الدفع :** نقداً (Espèces) : ${CurrencyUtil.formatDZDAr(metrics.paymentBreakdown.cash)} | بطاقات CIB / ذهبية : ${CurrencyUtil.formatDZDAr(metrics.paymentBreakdown.cib_edahabia)}`
        : `📊 **Bilan d'activité du jour :**\n` +
          `- **Chiffre d'Affaires TTC :** ${CurrencyUtil.formatDZD(metrics.revenue)}\n` +
          `- **Nombre de transactions :** ${metrics.transactionCount} ventes\n` +
          `- **Marge Brute Réalisée :** ${CurrencyUtil.formatDZD(metrics.grossMargin)} (${metrics.marginPercentage}%)\n` +
          `- **Panier Moyen :** ${CurrencyUtil.formatDZD(metrics.averageBasket)}\n` +
          `- **Règlements :** Espèces : ${CurrencyUtil.formatDZD(metrics.paymentBreakdown.cash)} | TPE CIB / Edahabia : ${CurrencyUtil.formatDZD(metrics.paymentBreakdown.cib_edahabia)}`;
      return { answer };
    }

    // 3. Surveillance des Ruptures de Stock ("وش راه ناقص فالستوك؟" / "rupture")
    if (q.includes('ناقص') || q.includes('ستوك') || q.includes('rupture') || q.includes('stock faible') || q.includes('منتهي')) {
      const lowStock = await inventoryService.getLowStockProducts();
      if (lowStock.length === 0) {
        return {
          answer: isAr
            ? '✅ **حالة المخزون ممتازة :** لا توجد أي منتجات منتهية أو أقل من الحد الأدنى للمخزون حالياً.'
            : '✅ **État des stocks optimal :** Aucun produit n\'a atteint son seuil d\'alerte ou n\'est en rupture.'
        };
      }

      const listStr = lowStock.map(p => `- **${isAr ? p.name_ar : p.name_fr}** : ${p.current_stock} unité(s) restante(s) (Seuil : ${p.min_stock_alert})`).join('\n');
      const answer = isAr
        ? `⚠️ **تنبيه المخزون : يوجد ${lowStock.length} منتج بحاجة إلى إعادة تموين :**\n\n${listStr}`
        : `⚠️ **Alerte Réapprovisionnement (${lowStock.length} articles concernés) :**\n\n${listStr}`;
      return { answer };
    }

    // 4. Surveillance des Péremptions FEFO ("شنو المنتجات لي راهي قريبة تخرج صلاحيتها؟")
    if (q.includes('صلاحية') || q.includes('péremption') || q.includes('expire') || q.includes('تاريخ')) {
      const expiring = await inventoryService.getExpiringSoonBatches(90);
      if (expiring.length === 0) {
        return {
          answer: isAr
            ? '✅ **سلامة الأغذية والمكملات :** لا توجد أي دفعات تنتهي صلاحيتها خلال الـ 90 يوماً القادمة.'
            : '✅ **Aucun risque de péremption :** Tous les lots en rayon ont une DLUO supérieure à 90 jours.'
        };
      }

      const listStr = expiring.map(b => `- **${b.product_name}** (Lot : \`${b.batch_number}\`) — Expire le **${b.expiration_date}** (${b.current_stock} unité(s))`).join('\n');
      const answer = isAr
        ? `🚨 **دفعات قريبة من انتهاء الصلاحية (خلال 90 يوماً) :**\n\n${listStr}\n\n*تذكير : يرجى تطبيق عروض تخفيض أو بيع هذه الدفعات بالأولوية وفق نظام FEFO.*`
        : `🚨 **Lots arrivant à échéance (sous 90 jours) :**\n\n${listStr}\n\n*Recommandation : Mettre ces références en avant ou appliquer une promotion destockage selon FEFO.*`;
      return { answer };
    }

    // Réponse générale d'aide
    return {
      answer: isAr
        ? `أهلاً بك في المساعد الذكي لمحل Aquadro Nutrition.\n\nيمكنك سؤالي باللغة العربية أو الفرنسية حول :\n- *« شحال بعنا اليوم؟ »*\n- *« وش راه ناقص فالستوك؟ »*\n- *« شنو المنتجات لي قربت تكمّل صلاحيتها؟ »*\n- *« خصم 2 علب واي بروتين تالفة »* (يتطلب موافقة المدير بالـ PIN)`
        : `Bonjour ! Je suis le copilote d'exploitation Aquadro POS Algérie.\n\nVous pouvez me poser des questions comme :\n- *« Combien avons-nous vendu aujourd'hui ? »*\n- *« Quels produits sont en rupture de stock ? »*\n- *« Quels lots périment bientôt ? »*\n- *« Déduire 2 boîtes avariées »* (Soumis à validation PIN Responsable)`
    };
  }

  // Exécuter une action approuvée par PIN Manager
  public async executeApprovedAction(
    action: NonNullable<AIResponse['proposedAction']>,
    managerPin: string
  ): Promise<boolean> {
    const pinCheck = await authService.verifyManagerOrOwnerPin(managerPin);
    if (!pinCheck.valid || !pinCheck.user) {
      throw new Error('Code PIN Responsable invalide ou non autorisé.');
    }

    if (action.type === 'STOCK_WRITE_OFF') {
      await inventoryService.recordMovement({
        productId: action.productId,
        movementType: 'DAMAGE',
        quantityChange: -action.quantity,
        reason: `Mise au rebut validée par IA (${action.reason}) - Approuvée par ${pinCheck.user.name}`,
        referenceId: `AI-ADJ-${Date.now().toString().slice(-6)}`,
        userId: pinCheck.user.id,
        userName: pinCheck.user.name
      });

      // Journaliser dans l'audit log
      await db.execute(
        `INSERT INTO audit_logs (id, user_id, user_name, action, entity_type, entity_id, details, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          `audit-${Date.now()}`,
          pinCheck.user.id,
          pinCheck.user.name,
          'AI_STOCK_WRITE_OFF',
          'PRODUCT',
          action.productId,
          `Déduction de ${action.quantity}x ${action.productName}. Motif: ${action.reason}`,
          new Date().toISOString()
        ]
      );
      return true;
    }

    return false;
  }
}

export const aiService = AIService.getInstance();
