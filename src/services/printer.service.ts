// Aquadro POS Algérie V2 — Service d'Impression Thermique (58mm & 80mm ESC/POS)
// Formatage conforme au commerce algérien, mentions DGI, et impulsion tiroir-caisse RJ11

import { CurrencyUtil } from '../core/currency/currency';
import { ZReportSummary } from './caisse.service';

export interface ReceiptPrintData {
  storeName?: string;
  storeNameFr?: string;
  storeNameAr?: string;
  storeAddress?: string;
  storePhone?: string;
  rcNumber?: string;
  nifNumber?: string;
  nisNumber?: string;
  aiNumber?: string;
  fiscalRegime?: 'IFU' | 'REEL';
  receiptNumber: string;
  dateTime: string;
  cashierName: string;
  customerName?: string;
  items: Array<{
    name: string;
    variant?: string;
    quantity: number;
    unitPrice: number;
    discount?: number;
    total: number;
  }>;
  subtotal?: number;
  subtotalHT?: number;
  discountTotal?: number;
  taxAmount?: number;
  taxRate?: number;
  totalTTC?: number;
  grandTotal?: number;
  paymentMethod?: string;
  payments?: Array<{ method: string; amount: number; tendered?: number; change?: number }>;
  tenderedAmount?: number;
  changeGiven?: number;
  footerMessage?: string;
  paperWidth?: '58mm' | '80mm';
}

export class PrinterService {
  private static instance: PrinterService;
  private lastReceiptData: ReceiptPrintData | null = null;

  private constructor() {}

  public static getInstance(): PrinterService {
    if (!PrinterService.instance) {
      PrinterService.instance = new PrinterService();
    }
    return PrinterService.instance;
  }

  public getConfig(): { paperWidth: '58mm' | '80mm'; autoPrint: boolean; openDrawerOnSale: boolean } {
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem('aquadro_printer_config');
        if (raw) return JSON.parse(raw);
      } catch (e) {}
    }
    return {
      paperWidth: '80mm',
      autoPrint: true,
      openDrawerOnSale: true
    };
  }

  public saveConfig(config: { paperWidth: '58mm' | '80mm'; autoPrint: boolean; openDrawerOnSale: boolean }): void {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('aquadro_printer_config', JSON.stringify(config));
      } catch (e) {}
    }
  }

  public getLastReceipt(): ReceiptPrintData | null {
    if (this.lastReceiptData) return this.lastReceiptData;
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem('aquadro_last_receipt');
        if (raw) {
          this.lastReceiptData = JSON.parse(raw);
          return this.lastReceiptData;
        }
      } catch (e) {}
    }
    return null;
  }

  public generateTextReceipt(data: ReceiptPrintData): string {
    return this.generateReceiptText(data);
  }

  // Génération du texte formaté pour ticket de caisse
  public generateReceiptText(data: ReceiptPrintData): string {
    const is80 = (data.paperWidth || this.getConfig().paperWidth) !== '58mm';
    const cols = is80 ? 44 : 32;

    const center = (str: string) => {
      const pad = Math.max(0, Math.floor((cols - str.length) / 2));
      return ' '.repeat(pad) + str;
    };

    const separator = '='.repeat(cols);
    const line = '-'.repeat(cols);

    const twoCols = (left: string, right: string) => {
      const spaces = Math.max(1, cols - left.length - right.length);
      return left + ' '.repeat(spaces) + right;
    };

    const out: string[] = [];

    // 1. Entête
    const storeFr = data.storeNameFr || data.storeName || 'Aquadro POS';
    out.push(center(storeFr.toUpperCase()));
    if (data.storeNameAr) out.push(center(data.storeNameAr));
    if (data.storeAddress) out.push(center(data.storeAddress));
    if (data.storePhone) out.push(center(`Tél: ${data.storePhone}`));
    if (data.rcNumber || data.nifNumber) {
      out.push(center(`RC: ${data.rcNumber || '-'} | NIF: ${data.nifNumber || '-'}`));
    }
    if (data.aiNumber) out.push(center(`Art. Imp: ${data.aiNumber}`));
    out.push(separator);

    // 2. Métadonnées du ticket
    const ticketTitle = (data.paymentMethod === 'CREDIT' || data.payments?.[0]?.method === 'CREDIT') ? 'BON DE CRÉDIT' : 'TICKET';
    out.push(twoCols(`${ticketTitle}: ${data.receiptNumber}`, ''));
    out.push(twoCols(`Date: ${data.dateTime}`, ''));
    out.push(twoCols(`Caissier: ${data.cashierName}`, data.customerName ? `Clt: ${data.customerName}` : ''));
    out.push(line);

    // 3. Articles vendus
    out.push(is80 ? twoCols('ARTICLE / QTÉ x PRIX', 'TOTAL TTC') : 'ARTICLE');
    out.push(line);

    for (const item of data.items) {
      const itemTitle = item.variant ? `${item.name} (${item.variant})` : item.name;
      out.push(itemTitle);
      const detailStr = `  ${item.quantity} x ${CurrencyUtil.formatDZD(item.unitPrice)}`;
      const totalStr = CurrencyUtil.formatDZD(item.total);
      out.push(twoCols(detailStr, totalStr));
      if (item.discount && item.discount > 0) {
        out.push(twoCols('  (Remise)', `-${CurrencyUtil.formatDZD(item.discount)}`));
      }
    }

    out.push(separator);

    // 4. Totaux & Fiscalité
    const totalTTC = data.totalTTC ?? data.grandTotal ?? 0;
    const subtotalHT = data.subtotalHT ?? data.subtotal ?? 0;
    const taxRate = data.taxRate ?? 0;
    const taxAmount = data.taxAmount ?? 0;
    const paymentMethod = data.paymentMethod || data.payments?.[0]?.method || 'CASH';
    const tenderedAmount = data.tenderedAmount ?? data.payments?.[0]?.tendered ?? totalTTC;
    const changeGiven = data.changeGiven ?? data.payments?.[0]?.change ?? 0;

    if (data.fiscalRegime === 'IFU') {
      out.push(center('RÉGIME FORFAITAIRE UNIQUE (IFU)'));
      out.push(center('Non assujetti à la TVA'));
      out.push(twoCols('NET À PAYER TTC:', CurrencyUtil.formatDZD(totalTTC)));
    } else {
      out.push(twoCols('Total Hors Taxe (HT):', CurrencyUtil.formatDZD(subtotalHT)));
      out.push(twoCols(`TVA (${(taxRate * 100).toFixed(0)}%):`, CurrencyUtil.formatDZD(taxAmount)));
      out.push(twoCols('TOTAL TTC:', CurrencyUtil.formatDZD(totalTTC)));
    }

    out.push(line);

    // 5. Règlements
    out.push(twoCols(`Règlement (${paymentMethod}):`, CurrencyUtil.formatDZD(totalTTC)));
    if (tenderedAmount > 0) {
      out.push(twoCols('Espèces reçues:', CurrencyUtil.formatDZD(tenderedAmount)));
      out.push(twoCols('Monnaie rendue:', CurrencyUtil.formatDZD(changeGiven)));
    }

    out.push(separator);

    // 6. Pied de page
    out.push(center('MERCI DE VOTRE CONFIANCE !'));
    out.push(center('شكرًا لزيارتكم ونتشرف بخدمتكم دائمًا'));
    out.push(center('Échange sous 15 jours sur présentation du ticket'));

    return out.join('\n');
  }

  // Génération du rendu HTML thermique professionnel
  public generateReceiptHtml(data: ReceiptPrintData): string {
    const is80 = (data.paperWidth || this.getConfig().paperWidth) !== '58mm';
    const totalTTC = data.totalTTC ?? data.grandTotal ?? 0;
    const subtotalHT = data.subtotalHT ?? data.subtotal ?? 0;
    const taxRate = data.taxRate ?? 0;
    const taxAmount = data.taxAmount ?? 0;
    const paymentMethod = data.paymentMethod || data.payments?.[0]?.method || 'CASH';
    const tenderedAmount = data.tenderedAmount ?? data.payments?.[0]?.tendered ?? totalTTC;
    const changeGiven = data.changeGiven ?? data.payments?.[0]?.change ?? 0;

    const storeFr = data.storeNameFr || data.storeName || 'MON MAGASIN';
    const storeAr = data.storeNameAr || '';

    let logoHtml = '';
    if (typeof window !== 'undefined') {
      try {
        const logoBase64 = localStorage.getItem('aquadro_store_logo');
        if (logoBase64) {
          logoHtml = `<div style="text-align: center; margin-bottom: 8px;"><img src="${logoBase64}" style="max-width: 100px; max-height: 100px; display: inline-block; filter: grayscale(100%) contrast(200%);" alt="Logo" /></div>`;
        }
      } catch (e) {}
    }

    return `
      <div class="thermal-receipt" style="font-family: 'Courier New', Courier, monospace; color: #000; line-height: 1.35; width: 100%; box-sizing: border-box;">
        <!-- EN-TETE DU MAGASIN -->
        ${logoHtml}
        <div style="text-align: center; margin-bottom: 8px;">
          <div style="font-size: 13px; font-weight: bold; letter-spacing: 0.5px;">${storeFr.toUpperCase()}</div>
          ${storeAr ? `<div style="font-size: 13px; font-weight: bold; direction: rtl; margin-top: 2px;">${storeAr}</div>` : ''}
          ${data.storeAddress ? `<div style="font-size: 10px; margin-top: 2px;">${data.storeAddress}</div>` : ''}
          ${data.storePhone ? `<div style="font-size: 10px;">Tél: ${data.storePhone}</div>` : ''}
          <div style="font-size: 10px; margin-top: 3px;">
            ${data.rcNumber ? `RC: ${data.rcNumber}` : ''} ${data.nifNumber ? `| NIF: ${data.nifNumber}` : ''}
          </div>
          ${data.aiNumber ? `<div style="font-size: 10px;">Art. Imp: ${data.aiNumber}</div>` : ''}
        </div>

        <div style="border-top: 1px dashed #000; margin: 6px 0;"></div>

        <!-- DETAILS TICKET -->
        <div style="font-size: 10.5px; margin-bottom: 6px;">
          <div style="display: flex; justify-content: space-between;">
            <strong>${(data.paymentMethod === 'CREDIT' || data.payments?.[0]?.method === 'CREDIT') ? 'BON DE CRÉDIT' : 'Ticket N°'}:</strong>
            <span style="font-weight: bold;">${data.receiptNumber}</span>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span>Date & Heure:</span>
            <span>${data.dateTime}</span>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span>Caissier:</span>
            <span>${data.cashierName}</span>
          </div>
          ${data.customerName ? `
            <div style="display: flex; justify-content: space-between;">
              <span>Client:</span>
              <strong>${data.customerName}</strong>
            </div>
          ` : ''}
        </div>

        <div style="border-top: 1px dashed #000; margin: 6px 0;"></div>

        <!-- TABLEAU DES ARTICLES -->
        <table style="width: 100%; border-collapse: collapse; font-size: 10.5px; text-align: left;">
          <thead>
            <tr style="border-bottom: 1px solid #000;">
              <th style="padding: 2px 0;">ARTICLE</th>
              <th style="text-align: center; padding: 2px 0;">QTÉ</th>
              <th style="text-align: right; padding: 2px 0;">P.U</th>
              <th style="text-align: right; padding: 2px 0;">TOTAL</th>
            </tr>
          </thead>
          <tbody>
            ${data.items.map(item => `
              <tr>
                <td colspan="4" style="padding-top: 4px; font-weight: bold;">
                  ${item.name} ${item.variant ? `<span style="font-size: 9.5px; font-weight: normal;">(${item.variant})</span>` : ''}
                </td>
              </tr>
              <tr style="border-bottom: 1px dotted #ccc;">
                <td style="padding-bottom: 4px;"></td>
                <td style="text-align: center; padding-bottom: 4px;">${item.quantity}</td>
                <td style="text-align: right; padding-bottom: 4px;">${CurrencyUtil.formatDZD(item.unitPrice)}</td>
                <td style="text-align: right; padding-bottom: 4px; font-weight: bold;">${CurrencyUtil.formatDZD(item.total)}</td>
              </tr>
              ${item.discount && item.discount > 0 ? `
                <tr>
                  <td colspan="3" style="font-size: 9.5px; color: #555; padding-bottom: 2px;">  (Remise)</td>
                  <td style="text-align: right; font-size: 9.5px; color: #555; padding-bottom: 2px;">-${CurrencyUtil.formatDZD(item.discount)}</td>
                </tr>
              ` : ''}
            `).join('')}
          </tbody>
        </table>

        <div style="border-top: 1px dashed #000; margin: 8px 0 6px 0;"></div>

        <!-- TOTAUX ET FISCALITÉ DGI -->
        <div style="font-size: 11px;">
          ${data.fiscalRegime === 'IFU' ? `
            <div style="text-align: center; font-size: 9.5px; font-weight: bold; border: 1px solid #000; padding: 2px; margin-bottom: 5px;">
              RÉGIME FORFAITAIRE UNIQUE (IFU) - Non assujetti à la TVA
            </div>
          ` : `
            <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
              <span>Total HT :</span>
              <span>${CurrencyUtil.formatDZD(subtotalHT)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
              <span>TVA (${(taxRate * 100).toFixed(0)}%) :</span>
              <span>${CurrencyUtil.formatDZD(taxAmount)}</span>
            </div>
          `}
          
          <div style="display: flex; justify-content: space-between; font-size: 13px; font-weight: bold; border-top: 1px solid #000; border-bottom: 1px solid #000; padding: 4px 0; margin-top: 4px;">
            <span>NET À PAYER TTC:</span>
            <span>${CurrencyUtil.formatDZD(totalTTC)}</span>
          </div>
        </div>

        <!-- MODE DE PAIEMENT & MONNAIE RENDUE -->
        <div style="font-size: 10.5px; margin-top: 6px; padding: 3px 0;">
          <div style="display: flex; justify-content: space-between;">
            <span>Mode Règlement:</span>
            <strong>${paymentMethod}</strong>
          </div>
          ${paymentMethod === 'CASH' && tenderedAmount > 0 ? `
            <div style="display: flex; justify-content: space-between;">
              <span>Espèces reçues:</span>
              <span>${CurrencyUtil.formatDZD(tenderedAmount)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 11.5px; font-weight: bold; margin-top: 2px;">
              <span>Monnaie rendue:</span>
              <span>${CurrencyUtil.formatDZD(changeGiven)}</span>
            </div>
          ` : ''}
        </div>

        <div style="border-top: 1px dashed #000; margin: 8px 0 6px 0;"></div>

        <!-- PIED DE TICKET -->
        <div style="text-align: center; font-size: 10px; margin-top: 6px;">
          <div style="font-weight: bold;">MERCI DE VOTRE VISITE !</div>
          <div style="font-size: 10.5px; font-weight: bold; direction: rtl; margin-top: 2px;">شكرًا لزيارتكم ونتشرف بخدمتكم دائمًا</div>
          <div style="font-size: 9px; margin-top: 4px;">Échange sous 15 jours sur présentation du ticket</div>
          <div style="font-size: 8px; color: #888; margin-top: 10px; font-weight: bold;">AQUADRO POS</div>
        </div>
      </div>
    `;
  }

  // Génération du rendu HTML A4 pour Bon de Crédit
  public generateA4CreditHtml(data: ReceiptPrintData): string {
    const totalTTC = data.totalTTC ?? data.grandTotal ?? 0;
    const subtotalHT = data.subtotalHT ?? data.subtotal ?? 0;
    const storeFr = data.storeNameFr || data.storeName || 'MON MAGASIN';
    const storeAr = data.storeNameAr || '';

    let logoHtml = '';
    if (typeof window !== 'undefined') {
      try {
        const logoBase64 = localStorage.getItem('aquadro_store_logo');
        if (logoBase64) {
          logoHtml = `<img src="${logoBase64}" style="max-width: 150px; max-height: 120px; display: inline-block;" alt="Logo" />`;
        }
      } catch (e) {}
    }

    // Barcode provenant d'une API publique gratuite
    const barcodeUrl = `https://bwipjs-api.metafloor.com/?bcid=code128&text=${encodeURIComponent(data.receiptNumber)}&scale=2&height=10&includetext`;

    return `
      <div class="paper-a4" style="color: #000; line-height: 1.5; width: 100%; box-sizing: border-box; background: white;">
        
        <!-- HEADER -->
        <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #000; padding-bottom: 20px; margin-bottom: 30px;">
          <div style="width: 30%;">
            ${logoHtml}
          </div>
          <div style="width: 40%; text-align: center;">
            <h1 style="margin: 0; font-size: 24px; text-transform: uppercase;">${storeFr}</h1>
            ${storeAr ? `<h2 style="margin: 5px 0 0 0; font-size: 20px; direction: rtl;">${storeAr}</h2>` : ''}
            <p style="margin: 5px 0 0 0; font-size: 12px; color: #555;">${data.storeAddress || ''}</p>
            <p style="margin: 2px 0 0 0; font-size: 12px; color: #555;">${data.storePhone ? 'Tél: ' + data.storePhone : ''}</p>
          </div>
          <div style="width: 30%; text-align: right;">
            <img src="${barcodeUrl}" style="max-width: 100%; height: auto;" alt="Barcode" />
          </div>
        </div>

        <!-- TITLE -->
        <div style="text-align: center; margin-bottom: 30px;">
          <h2 style="margin: 0; font-size: 24px; border: 2px solid #000; display: inline-block; padding: 10px 30px; background-color: #f8f9fa;">BON DE CRÉDIT / REÇU DE FACILITÉ</h2>
        </div>

        <!-- INFO CLIENT & FACTURE -->
        <div style="display: flex; justify-content: space-between; margin-bottom: 30px; font-size: 14px;">
          <div style="width: 48%; border: 1px solid #ccc; padding: 15px; border-radius: 5px;">
            <h3 style="margin-top: 0; border-bottom: 1px solid #eee; padding-bottom: 5px; color: #333; font-size: 16px;">Informations Magasin</h3>
            <p style="margin: 5px 0;"><strong>N° Registre Commerce:</strong> ${data.rcNumber || '-'}</p>
            <p style="margin: 5px 0;"><strong>NIF:</strong> ${data.nifNumber || '-'}</p>
            <p style="margin: 5px 0;"><strong>Art. Impo:</strong> ${data.aiNumber || '-'}</p>
            <p style="margin: 5px 0;"><strong>Caissier/Vendeur:</strong> ${data.cashierName}</p>
          </div>
          <div style="width: 48%; border: 1px solid #000; padding: 15px; border-radius: 5px; background-color: #fcfcfc;">
            <h3 style="margin-top: 0; border-bottom: 1px solid #eee; padding-bottom: 5px; color: #333; font-size: 16px;">Informations Client & Opération</h3>
            <p style="margin: 5px 0;"><strong>N° Document:</strong> <span style="font-weight: bold; font-family: monospace;">${data.receiptNumber}</span></p>
            <p style="margin: 5px 0;"><strong>Date :</strong> ${data.dateTime}</p>
            <p style="margin: 5px 0;"><strong>Nom du Client:</strong> <span style="font-size: 18px; font-weight: bold;">${data.customerName || 'NON DÉFINI'}</span></p>
          </div>
        </div>

        <!-- ARTICLES -->
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px; font-size: 14px;">
          <thead>
            <tr style="background-color: #f1f1f1;">
              <th style="padding: 10px; text-align: left; border: 1px solid #000;">Désignation</th>
              <th style="padding: 10px; text-align: center; border: 1px solid #000; width: 10%;">Qté</th>
              <th style="padding: 10px; text-align: right; border: 1px solid #000; width: 20%;">Prix Unitaire</th>
              <th style="padding: 10px; text-align: right; border: 1px solid #000; width: 20%;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${data.items.map(item => `
              <tr>
                <td style="padding: 10px; border: 1px solid #000;">
                  ${item.name} ${item.variant ? `<br><small style="color: #666;">(${item.variant})</small>` : ''}
                </td>
                <td style="padding: 10px; text-align: center; border: 1px solid #000;">${item.quantity}</td>
                <td style="padding: 10px; text-align: right; border: 1px solid #000;">${CurrencyUtil.formatDZD(item.unitPrice)}</td>
                <td style="padding: 10px; text-align: right; border: 1px solid #000; font-weight: bold;">${CurrencyUtil.formatDZD(item.total)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <!-- TOTALS -->
        <div style="display: flex; justify-content: flex-end; margin-bottom: 50px;">
          <div style="width: 50%; border: 2px solid #000; padding: 15px; border-radius: 5px; background-color: #f8f9fa;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 10px; font-size: 14px;">
              <span>Total HT :</span>
              <span>${CurrencyUtil.formatDZD(subtotalHT)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 10px; font-size: 14px;">
              <span>TVA (${(data.taxRate || 0) * 100}%) :</span>
              <span>${CurrencyUtil.formatDZD(data.taxAmount || 0)}</span>
            </div>
            <div style="border-top: 1px solid #ccc; margin: 10px 0;"></div>
            <div style="display: flex; justify-content: space-between; font-size: 22px; font-weight: bold; color: #000;">
              <span>NET À PAYER :</span>
              <span>${CurrencyUtil.formatDZD(totalTTC)}</span>
            </div>
            <div style="margin-top: 15px; text-align: center; font-size: 12px; color: #d32f2f; font-weight: bold;">
              * CE MONTANT SERA AJOUTÉ À LA DETTE DU CLIENT
            </div>
          </div>
        </div>

        <!-- SIGNATURES -->
        <div style="display: flex; justify-content: space-between; margin-top: 50px; font-size: 14px;">
          <div style="width: 40%; text-align: center;">
            <p style="font-weight: bold; text-decoration: underline;">Signature du Client</p>
            <p style="font-size: 11px; color: #666; margin-bottom: 80px;">(Lu et approuvé)</p>
            <div style="border-bottom: 1px dashed #000; width: 80%; margin: 0 auto;"></div>
          </div>
          <div style="width: 40%; text-align: center;">
            <p style="font-weight: bold; text-decoration: underline;">Signature du Propriétaire / Gérant</p>
            <p style="font-size: 11px; color: #666; margin-bottom: 80px;">(Cachet et signature)</p>
            <div style="border-bottom: 1px dashed #000; width: 80%; margin: 0 auto;"></div>
          </div>
        </div>

        <!-- FOOTER -->
        <div style="text-align: center; margin-top: 50px; font-size: 11px; color: #666; border-top: 1px solid #eee; padding-top: 10px;">
          Document généré le ${new Date().toLocaleString()}. <br/>
          Merci de conserver ce document comme justificatif de dette.<br/>
          <strong style="font-size: 10px; color: #333;">AQUADRO POS</strong>
        </div>
      </div>
    `;
  }

  // Envoyer la commande d'éjection du tiroir-caisse RJ11
  public async kickCashDrawer(): Promise<boolean> {
    if (typeof window !== 'undefined' && typeof (window as any).__TAURI_INTERNALS__?.invoke === 'function') {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('open_cash_drawer', { pin: 0 });
        console.log('Impulsion RJ11 envoyée au tiroir-caisse via Tauri');
        return true;
      } catch (err) {
        console.warn('Erreur impulsion native tiroir-caisse:', err);
      }
    }
    console.log('[Simulateur] Impulsion électrique 24V envoyée au port RJ11 (ESC p 0 25 250)');
    return true;
  }

  public generateZReportHtml(data: ZReportSummary): string {
    const is80 = this.getConfig().paperWidth !== '58mm';
    let logoHtml = '';
    if (typeof window !== 'undefined') {
      try {
        const logoBase64 = localStorage.getItem('aquadro_store_logo');
        if (logoBase64) {
          logoHtml = `<div style="text-align: center; margin-bottom: 8px;"><img src="${logoBase64}" style="max-width: 100px; max-height: 100px; display: inline-block; filter: grayscale(100%) contrast(200%);" alt="Logo" /></div>`;
        }
      } catch (e) {}
    }

    return `
      <div class="thermal-receipt" style="font-family: 'Courier New', Courier, monospace; color: #000; line-height: 1.35; width: 100%; box-sizing: border-box;">
        ${logoHtml}
        <div style="text-align: center; margin-bottom: 8px;">
          <div style="font-size: 13px; font-weight: bold;">RAPPORT Z (CLÔTURE DE CAISSE)</div>
          <div style="font-size: 10px; margin-top: 2px;">${new Date(data.generatedAt).toLocaleString()}</div>
        </div>
        <div style="border-top: 1px dashed #000; margin: 6px 0;"></div>
        <div style="font-size: 11px;">
          <div style="display: flex; justify-content: space-between;"><span>Caissier:</span> <span>${data.session.cashier_name}</span></div>
          <div style="display: flex; justify-content: space-between;"><span>Fond Initial:</span> <span>${CurrencyUtil.formatDZD(data.session.opening_float)}</span></div>
          <div style="display: flex; justify-content: space-between;"><span>Ventes Espèces:</span> <span>${CurrencyUtil.formatDZD(data.paymentBreakdown.cash)}</span></div>
          <div style="display: flex; justify-content: space-between;"><span>Ventes CIB/Carte:</span> <span>${CurrencyUtil.formatDZD(data.paymentBreakdown.cib)}</span></div>
          <div style="display: flex; justify-content: space-between;"><span>Crédit/Impayé:</span> <span>${CurrencyUtil.formatDZD(data.paymentBreakdown.credit)}</span></div>
          <div style="display: flex; justify-content: space-between; color: red;"><span>Dépenses:</span> <span>-${CurrencyUtil.formatDZD(data.session.total_cash_expenses)}</span></div>
          <div style="border-top: 1px dashed #000; margin: 6px 0;"></div>
          <div style="display: flex; justify-content: space-between; font-weight: bold;"><span>Total Espèces Attendu:</span> <span>${CurrencyUtil.formatDZD(data.cashInDrawerExpected)}</span></div>
          <div style="display: flex; justify-content: space-between; font-weight: bold;"><span>Espèces Recomptées:</span> <span>${CurrencyUtil.formatDZD(data.cashInDrawerCounted)}</span></div>
          <div style="border-top: 1px dashed #000; margin: 6px 0;"></div>
          <div style="display: flex; justify-content: space-between; font-weight: bold;"><span>Écart:</span> <span>${CurrencyUtil.formatDZD(data.discrepancy)}</span></div>
        </div>
        <div style="border-top: 1px dashed #000; margin: 6px 0;"></div>
        <div style="text-align: center; font-size: 10px; margin-top: 15px;">
          <br/><br/>
          <span>Signature Responsable</span>
        </div>
      </div>
    `;
  }

  public async printZReport(data: ZReportSummary, triggerBrowserPrint = true): Promise<void> {
    const config = this.getConfig();

    if (typeof window !== 'undefined') {
      let printArea = document.getElementById('thermal-print-area');
      if (!printArea) {
        printArea = document.createElement('div');
        printArea.id = 'thermal-print-area';
        document.body.appendChild(printArea);
      }
      const paperWidth = config.paperWidth || '80mm';
      printArea.className = paperWidth === '58mm' ? 'paper-58mm' : 'paper-80mm';
      printArea.innerHTML = this.generateZReportHtml(data);
    }

    if (triggerBrowserPrint && typeof window !== 'undefined') {
      setTimeout(() => {
        window.print();
      }, 50);
    }
  }

  // Imprimer le ticket
  public async printReceipt(data: ReceiptPrintData, triggerBrowserPrint = true): Promise<void> {
    this.lastReceiptData = data;
    const config = this.getConfig();

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('aquadro_last_receipt', JSON.stringify(data));
      } catch (e) {}

      // Mettre à jour la zone dédiée #thermal-print-area pour @media print
      let printArea = document.getElementById('thermal-print-area');
      if (!printArea) {
        printArea = document.createElement('div');
        printArea.id = 'thermal-print-area';
        document.body.appendChild(printArea);
      }

      // Déterminer si on imprime un reçu A4 Crédit ou un ticket thermique
      const isCredit = data.paymentMethod === 'CREDIT' || data.payments?.[0]?.method === 'CREDIT';

      if (isCredit) {
        printArea.className = 'paper-a4';
        printArea.innerHTML = this.generateA4CreditHtml(data);
      } else {
        const paperWidth = data.paperWidth || config.paperWidth || '80mm';
        printArea.className = paperWidth === '58mm' ? 'paper-58mm' : 'paper-80mm';
        printArea.innerHTML = this.generateReceiptHtml(data);
      }
    }

    const receiptText = this.generateReceiptText(data);

    // Si environnement Tauri natif
    if (typeof window !== 'undefined' && typeof (window as any).__TAURI_INTERNALS__?.invoke === 'function') {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('raw_print_receipt', { content: receiptText, printer_name: null });
      } catch (err) {
        console.warn('Impression native spooler non disponible :', err);
      }
    }

    // Ouvrir le dialogue d'impression système
    if (triggerBrowserPrint && typeof window !== 'undefined') {
      setTimeout(() => {
        window.print();
      }, 50);
    }
  }

  public async printSetupCharter(storeName: string, dbPin: string): Promise<void> {
    const html = `
      <div class="paper-a4" style="font-family: Arial, sans-serif; color: #000; width: 100%; box-sizing: border-box; background: white; padding: 40px;">
        <div style="text-align: center; border-bottom: 2px solid #000; padding-bottom: 20px; margin-bottom: 30px;">
          <h1 style="font-size: 28px; font-weight: bold; margin: 0; letter-spacing: 2px;">AQUADRO POS</h1>
          <h2 style="font-size: 18px; color: #555; margin: 10px 0 0 0;">DOCUMENT CONFIDENTIEL D'INITIALISATION</h2>
        </div>
        
        <div style="display: flex; justify-content: space-between; margin-bottom: 30px;">
          <div>
            <p style="font-size: 14px; margin: 5px 0;"><strong>MAGASIN :</strong> ${storeName}</p>
            <p style="font-size: 14px; margin: 5px 0;"><strong>DATE :</strong> ${new Date().toLocaleString()}</p>
          </div>
        </div>
        
        <div style="text-align: center; background-color: #fcfcfc; border: 2px solid #000; padding: 20px; border-radius: 8px; margin-bottom: 40px;">
          <h3 style="font-size: 16px; font-weight: bold; margin: 0 0 15px 0;">CODE SECRET DE LA BASE DE DONNÉES (DANGER ZONE PIN)</h3>
          <p style="font-size: 36px; font-weight: bold; letter-spacing: 10px; margin: 10px 0; color: #d32f2f; font-family: monospace;">${dbPin}</p>
          <p style="font-size: 14px; font-weight: bold; color: #d32f2f; margin-top: 15px;">ATTENTION : CE CODE EST STRICTEMENT CONFIDENTIEL.</p>
          <p style="font-size: 12px; color: #555;">Il est requis pour effectuer un Factory Reset et formater la base de données.</p>
        </div>
        
        <div style="border-top: 2px solid #000; margin: 30px 0;"></div>
        
        <h3 style="font-size: 20px; font-weight: bold; margin: 20px 0; text-align: center;">ميثاق الاستخدام (Charte d'Utilisation)</h3>
        
        <div style="background-color: #f9f9f9; border: 1px solid #ccc; padding: 25px; border-radius: 5px; direction: rtl; text-align: right;">
          <p style="font-size: 16px; margin-bottom: 15px; font-weight: bold;">
            بموافقتك على استخدام هذا النظام (Aquadro POS)، فإنك تتعهد وتوافق على الميثاق التالي:
          </p>
          <ul style="font-size: 14px; padding-right: 20px; line-height: 1.8; margin-bottom: 20px;">
            <li>النظام مصمم لتسهيل عمليات البيع والإدارة، ولا يتحمل المطور أي مسؤولية قانونية عن أخطاء إدخال البيانات أو ضياعها.</li>
            <li>الرمز السري لقاعدة البيانات (DB PIN) المطبوع أعلاه هو مسؤوليتك الخاصة. فقدانه أو تسريبه قد يؤدي إلى فقدان بياناتك بالكامل.</li>
            <li>عند قيامك بطلب إعادة ضبط المصنع (Factory Reset) من الإعدادات، فإنك توافق على أن النظام سيقوم بمسح كافة البيانات من الجهاز نهائياً.</li>
            <li>يمنع منعاً باتاً الهندسة العكسية للبرنامج، استنساخه، أو توزيعه بدون إذن كتابي مسبق.</li>
          </ul>
        </div>
        
        <div style="display: flex; justify-content: space-between; margin-top: 60px;">
          <div style="width: 45%; text-align: center;">
            <p style="font-weight: bold; font-size: 16px; margin-bottom: 10px; text-decoration: underline;">Signature du Propriétaire</p>
            <p style="font-size: 12px; color: #666; margin-bottom: 80px;">(Lu et approuvé)</p>
            <div style="border-bottom: 1px dashed #000; width: 80%; margin: 0 auto;"></div>
          </div>
          
          <div style="width: 45%; text-align: center;">
            <p style="font-weight: bold; font-size: 16px; margin-bottom: 10px; text-decoration: underline;">Concepteur du Système</p>
            <p style="font-size: 16px; font-weight: bold; color: #333; margin-top: 30px;">Boudelaa Youcef Seddik</p>
            <p style="font-size: 14px; font-weight: bold; color: #333; margin-top: 5px;">بوضلعة يوسف الصديق</p>
          </div>
        </div>
        
        <div style="text-align: center; margin-top: 60px; font-size: 11px; color: #888; border-top: 1px solid #eee; padding-top: 15px;">
          Document d'initialisation généré par AQUADRO POS.<br/>
          <strong>Veuillez conserver ce document en lieu sûr.</strong>
        </div>
      </div>
    `;
    
    if (typeof window !== 'undefined') {
      let printArea = document.getElementById('thermal-print-area');
      if (!printArea) {
        printArea = document.createElement('div');
        printArea.id = 'thermal-print-area';
        document.body.appendChild(printArea);
      }
      printArea.className = 'paper-a4';
      printArea.innerHTML = html;
      
      setTimeout(() => {
        window.print();
      }, 50);
    }
  }
}

export const printerService = PrinterService.getInstance();
