import { Product, Customer } from '../types/database';
import { CartItem, CartState, CartTotals, OrderDiscount } from '../types/pos';

import { CurrencyUtil } from '../utils/currency';

export class CartService {
  /**
   * Helper to round monetary amounts safely
   */
  public static roundCurrency(amount: number): number {
    return Math.round((amount + Number.EPSILON) * 100) / 100;
  }

  /**
   * Initializes a fresh cart with configurable Algerian TVA (default 0.0 for IFU)
   */
  public static createEmptyCart(taxRate: number = 0.0): CartState {
    return {
      items: [],
      customer: null,
      orderDiscount: null,
      taxRate: taxRate,
      notes: ''
    };
  }

  /**
   * Adds a product to the cart or increments existing line quantity
   */
  public static addItem(cart: CartState, product: Product, quantity: number = 1): CartState {
    if (quantity <= 0) return cart;

    const existingIndex = cart.items.findIndex(i => i.productId === product.id);
    const effectivePrice = product.discount_price ?? product.selling_price_ttc ?? product.selling_price ?? 0;

    let newItems: CartItem[];

    if (existingIndex >= 0) {
      newItems = cart.items.map((item, idx) => {
        if (idx === existingIndex) {
          const newQty = item.quantity + quantity;
          const lineTotal = this.roundCurrency((newQty * item.unitPrice) - item.discountAmount);
          return {
            ...item,
            quantity: newQty,
            totalPrice: Math.max(0, lineTotal)
          };
        }
        return item;
      });
    } else {
      const lineTotal = this.roundCurrency(quantity * effectivePrice);
      const newItem: CartItem = {
        id: 'cart-item-' + Math.random().toString(36).substring(2, 9),
        productId: product.id,
        product: product,
        quantity: quantity,
        unitPrice: effectivePrice,
        unitPurchasePrice: product.purchase_cost ?? product.purchase_price ?? 0,
        discountAmount: 0,
        discountPercent: 0,
        totalPrice: lineTotal,
        batchNumber: product.batch_number || product.batches?.[0]?.batch_number
      };
      newItems = [...cart.items, newItem];
    }

    return {
      ...cart,
      items: newItems
    };
  }

  /**
   * Updates line item quantity
   */
  public static updateQuantity(cart: CartState, itemId: string, quantity: number): CartState {
    if (quantity <= 0) {
      return this.removeItem(cart, itemId);
    }

    const newItems = cart.items.map(item => {
      if (item.id === itemId) {
        // Recalculate discount if percent-based
        let discount = item.discountAmount;
        if (item.discountPercent > 0) {
          discount = this.roundCurrency((quantity * item.unitPrice * item.discountPercent) / 100);
        }
        const lineTotal = this.roundCurrency((quantity * item.unitPrice) - discount);
        return {
          ...item,
          quantity,
          discountAmount: discount,
          totalPrice: Math.max(0, lineTotal)
        };
      }
      return item;
    });

    return {
      ...cart,
      items: newItems
    };
  }

  /**
   * Removes item from cart
   */
  public static removeItem(cart: CartState, itemId: string): CartState {
    return {
      ...cart,
      items: cart.items.filter(item => item.id !== itemId)
    };
  }

  /**
   * Applies line item discount (percentage or fixed amount)
   */
  public static applyLineDiscount(
    cart: CartState,
    itemId: string,
    percent: number,
    fixedAmount?: number
  ): CartState {
    const newItems = cart.items.map(item => {
      if (item.id === itemId) {
        const gross = item.quantity * item.unitPrice;
        let discount = 0;
        let finalPercent = 0;

        if (fixedAmount !== undefined && fixedAmount > 0) {
          discount = Math.min(gross, fixedAmount);
          finalPercent = gross > 0 ? (discount / gross) * 100 : 0;
        } else if (percent > 0) {
          finalPercent = Math.min(100, Math.max(0, percent));
          discount = (gross * finalPercent) / 100;
        }

        discount = this.roundCurrency(discount);
        const lineTotal = this.roundCurrency(gross - discount);

        return {
          ...item,
          discountPercent: this.roundCurrency(finalPercent),
          discountAmount: discount,
          totalPrice: Math.max(0, lineTotal)
        };
      }
      return item;
    });

    return {
      ...cart,
      items: newItems
    };
  }

  /**
   * Applies overall order discount
   */
  public static applyOrderDiscount(cart: CartState, discount: OrderDiscount | null): CartState {
    return {
      ...cart,
      orderDiscount: discount
    };
  }

  /**
   * Attaches customer to cart
   */
  public static setCustomer(cart: CartState, customer: Customer | null): CartState {
    return {
      ...cart,
      customer
    };
  }

  /**
   * Calculates comprehensive cart totals
   */
  public static calculateTotals(cart: CartState): CartTotals {
    // 1. Raw gross subtotal
    let subtotal = 0;
    let itemsDiscount = 0;
    let itemCount = 0;

    for (const item of cart.items) {
      subtotal += item.quantity * item.unitPrice;
      itemsDiscount += item.discountAmount;
      itemCount += item.quantity;
    }

    subtotal = this.roundCurrency(subtotal);
    itemsDiscount = this.roundCurrency(itemsDiscount);

    // 2. Net items total after item discounts
    const netAfterItemDiscounts = Math.max(0, subtotal - itemsDiscount);

    // 3. Order-level discount
    let orderDiscountAmount = 0;
    if (cart.orderDiscount && netAfterItemDiscounts > 0) {
      if (cart.orderDiscount.type === 'PERCENTAGE') {
        orderDiscountAmount = (netAfterItemDiscounts * cart.orderDiscount.value) / 100;
      } else {
        orderDiscountAmount = cart.orderDiscount.value;
      }
      orderDiscountAmount = Math.min(netAfterItemDiscounts, orderDiscountAmount);
      orderDiscountAmount = this.roundCurrency(orderDiscountAmount);
    }

    const totalDiscount = this.roundCurrency(itemsDiscount + orderDiscountAmount);
    const taxableAmount = Math.max(0, this.roundCurrency(subtotal - totalDiscount));
    const taxAmount = this.roundCurrency(taxableAmount * cart.taxRate);
    const total = this.roundCurrency(taxableAmount + taxAmount);

    return {
      subtotal,
      itemsDiscount,
      orderDiscountAmount,
      totalDiscount,
      taxableAmount,
      taxAmount,
      total,
      itemCount
    };
  }

  /**
   * Calculates change given total amount and tendered amount
   */
  public static calculateChange(total: number, tenderedAmount: number): number {
    if (tenderedAmount <= total) return 0;
    return this.roundCurrency(tenderedAmount - total);
  }
}
