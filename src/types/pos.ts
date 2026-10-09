import { Product, Customer, PaymentMethod } from './database';

export interface CartItem {
  id: string; // unique item line id (e.g. UUID)
  productId: string;
  product: Product;
  quantity: number;
  unitPrice: number;
  unitPurchasePrice: number;
  discountAmount: number; // line discount in currency
  discountPercent: number; // percentage discount (0-100)
  totalPrice: number;
  batchNumber?: string;
  notes?: string;
}

export type OrderDiscountType = 'PERCENTAGE' | 'FIXED';

export interface OrderDiscount {
  type: OrderDiscountType;
  value: number; // percentage (e.g. 10 for 10%) or fixed currency amount (e.g. 5.00)
  reason?: string;
}

export interface CartState {
  items: CartItem[];
  customer: Customer | null;
  orderDiscount: OrderDiscount | null;
  taxRate: number; // e.g. 0.08
  notes: string;
  heldId?: string; // If resuming a held sale
}

export interface CartTotals {
  subtotal: number;
  itemsDiscount: number;
  orderDiscountAmount: number;
  totalDiscount: number;
  taxableAmount: number;
  taxAmount: number;
  total: number;
  itemCount: number;
}

export interface PaymentEntry {
  method: PaymentMethod;
  amount: number;
  tenderedAmount: number;
  changeGiven: number;
  cardBrand?: string;
  cardLastFour?: string;
  authCode?: string;
}

export interface HeldSale {
  id: string;
  heldAt: string;
  cashierId: string;
  customerName?: string;
  itemCount: number;
  subtotal: number;
  cartState: CartState;
}
