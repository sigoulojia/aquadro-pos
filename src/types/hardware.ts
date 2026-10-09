export type ThermalWidth = '58mm' | '80mm';

export type PrinterInterface = 'system' | 'raw_tcp' | 'serial' | 'browser_preview';

export interface PrinterConfig {
  printerName: string;
  interfaceType: PrinterInterface;
  paperWidth: ThermalWidth;
  ipAddress?: string;
  tcpPort?: number;
  serialPort?: string;
  baudRate?: number;
  autoCut: boolean;
  openDrawerOnSale: boolean;
  printLogo: boolean;
  copies: number;
}

export interface ReceiptData {
  storeName: string;
  storeAddress: string;
  storePhone: string;
  taxNumber?: string;
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
  subtotal: number;
  discountTotal: number;
  taxAmount: number;
  taxRate: number;
  grandTotal: number;
  payments: Array<{
    method: string;
    amount: number;
    tendered: number;
    change: number;
  }>;
  barcode?: string;
  headerMessage?: string;
  footerMessage?: string;
}

export interface CashDrawerConfig {
  enabled: boolean;
  kickCommand: 'standard_pin2' | 'standard_pin5' | 'custom';
  customHex?: string;
}
