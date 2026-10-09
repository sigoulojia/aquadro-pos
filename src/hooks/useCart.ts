import { useState, useCallback, useEffect } from 'react';
import { CartState, CartTotals, OrderDiscount, HeldSale } from '../types/pos';
import { Product, Customer } from '../types/database';
import { CartService } from '../services/cart.service';

export function useCart(initialTaxRate: number = 0.0) {
  const [cart, setCart] = useState<CartState>(() => {
    try {
      const saved = sessionStorage.getItem('aquadro_current_cart');
      if (saved) return JSON.parse(saved);
    } catch {}
    return CartService.createEmptyCart(initialTaxRate);
  });

  const [heldSales, setHeldSales] = useState<HeldSale[]>(() => {
    try {
      const saved = localStorage.getItem('aquadro_held_sales');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });

  useEffect(() => {
    try {
      sessionStorage.setItem('aquadro_current_cart', JSON.stringify(cart));
    } catch {}
  }, [cart]);

  useEffect(() => {
    try {
      localStorage.setItem('aquadro_held_sales', JSON.stringify(heldSales));
    } catch {}
  }, [heldSales]);

  const addItem = useCallback((product: Product, quantity: number = 1) => {
    setCart(prev => CartService.addItem(prev, product, quantity));
  }, []);

  const updateQuantity = useCallback((itemId: string, quantity: number) => {
    setCart(prev => CartService.updateQuantity(prev, itemId, quantity));
  }, []);

  const removeItem = useCallback((itemId: string) => {
    setCart(prev => CartService.removeItem(prev, itemId));
  }, []);

  const applyLineDiscount = useCallback((itemId: string, percent: number, fixedAmount?: number) => {
    setCart(prev => CartService.applyLineDiscount(prev, itemId, percent, fixedAmount));
  }, []);

  const applyOrderDiscount = useCallback((discount: OrderDiscount | null) => {
    setCart(prev => CartService.applyOrderDiscount(prev, discount));
  }, []);

  const setCustomer = useCallback((customer: Customer | null) => {
    setCart(prev => CartService.setCustomer(prev, customer));
  }, []);

  const clearCart = useCallback(() => {
    setCart(CartService.createEmptyCart(initialTaxRate));
  }, [initialTaxRate]);

  const holdSale = useCallback((cashierId: string) => {
    if (cart.items.length === 0) return;
    const totals = CartService.calculateTotals(cart);
    const newHeld: HeldSale = {
      id: 'held-' + Math.random().toString(36).substring(2, 9),
      heldAt: new Date().toISOString(),
      cashierId,
      customerName: cart.customer?.name,
      itemCount: totals.itemCount,
      subtotal: totals.subtotal,
      cartState: { ...cart }
    };
    setHeldSales(prev => [...prev, newHeld]);
    clearCart();
  }, [cart, clearCart]);

  const resumeSale = useCallback((heldId: string) => {
    const sale = heldSales.find(s => s.id === heldId);
    if (!sale) return;
    setCart(sale.cartState);
    setHeldSales(prev => prev.filter(s => s.id !== heldId));
  }, [heldSales]);

  const totals: CartTotals = CartService.calculateTotals(cart);

  return {
    cart,
    totals,
    heldSales,
    addItem,
    updateQuantity,
    removeItem,
    applyLineDiscount,
    applyOrderDiscount,
    setCustomer,
    clearCart,
    holdSale,
    resumeSale
  };
}
