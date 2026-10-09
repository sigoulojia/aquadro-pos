// Aquadro POS Algérie V2 — Écran de Vente au Comptoir (POS Checkout)
// Disposition 2 colonnes ultra-rapide : Catalogue/Scanner à gauche, Panier & Règlements à droite

import React, { useState, useEffect, useRef } from 'react';
import { productService } from '../../services/product.service';
import { checkoutService, CheckoutItemInput } from '../../services/checkout.service';
import { caisseService } from '../../services/caisse.service';
import { customerService } from '../../services/customer.service';
import { printerService } from '../../services/printer.service';
import { ReceiptModal } from '../common/ReceiptModal';
import { CameraScanner } from '../common/CameraScanner';
import { useAuth } from '../../hooks/useAuth';
import { useI18n } from '../../i18n';
import { useToast } from '../common/Toast';
import { Product, Customer, PaymentMethod, CashSession } from '../../types/database';
import { CurrencyUtil } from '../../core/currency/currency';
import { useShortcut, useKeyboardScope, useScanner } from '../../core/keyboard/useKeyboard';
import { ScannerInputManager } from '../../core/keyboard/ScannerInputManager';
import {
  Search,
  Barcode,
  Camera,
  Plus,
  Minus,
  Trash2,
  CheckCircle,
  CreditCard,
  Banknote,
  QrCode,
  Users,
  Clock,
  Printer
} from 'lucide-react';

interface CartItem extends CheckoutItemInput {
  maxStock: number;
}

export const PosView: React.FC = () => {
  const { user } = useAuth();
  const { t, language } = useI18n();
  const { showToast } = useToast();

  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [search, setSearch] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [heldCarts, setHeldCarts] = useState<{ id: string; items: CartItem[]; customerId: string; time: string }[]>(() => {
    try {
      const saved = localStorage.getItem('aquadro_held_carts');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem('aquadro_held_carts', JSON.stringify(heldCarts));
  }, [heldCarts]);
  const [showHeldSalesPanel, setShowHeldSalesPanel] = useState<boolean>(false);

  // Modal de paiement rapide
  const [showPayModal, setShowPayModal] = useState<boolean>(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [tenderedInput, setTenderedInput] = useState<string>('');
  const [tpeReference, setTpeReference] = useState<string>('');
  const [activeSession, setActiveSession] = useState<CashSession | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [lastReceipt, setLastReceipt] = useState<any | null>(null);
  const [showReceiptModal, setShowReceiptModal] = useState<boolean>(false);
  const [showCameraScanner, setShowCameraScanner] = useState<boolean>(false);

  // Dedicated barcode scanner input state & ref
  const [barcodeInput, setBarcodeInput] = useState<string>('');
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const manualSearchInputRef = useRef<HTMLInputElement>(null);

  // Auto-focus dedicated barcode scanner input when POS screen is active
  useEffect(() => {
    const timer = setTimeout(() => {
      barcodeInputRef.current?.focus();
    }, 60);
    return () => clearTimeout(timer);
  }, []);

  // --- KEYBOARD & BARCODE STATE ---
  const [selectedCartIndex, setSelectedCartIndex] = useState<number>(-1);

  // Active keyboard scope based on open modals
  const isAnyModalOpen = showPayModal || showReceiptModal || showHeldSalesPanel || showCameraScanner;
  useKeyboardScope('pos', !isAnyModalOpen);
  useKeyboardScope('pay_modal', showPayModal);

  // Refocus dedicated barcode scanner input when any modal/panel is closed
  useEffect(() => {
    if (!isAnyModalOpen) {
      const timer = setTimeout(() => {
        barcodeInputRef.current?.focus();
      }, 60);
      return () => clearTimeout(timer);
    }
  }, [isAnyModalOpen]);

  // Keep barcode focus active on neutral clicks
  const handleContainerClick = (e: React.MouseEvent) => {
    if (isAnyModalOpen) return;
    const target = e.target as HTMLElement;
    if (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.tagName === 'SELECT' ||
      target.isContentEditable ||
      target.closest('button') ||
      target.closest('.no-autofocus')
    ) {
      return;
    }
    barcodeInputRef.current?.focus();
  };

  useShortcut('Enter', (e) => {
    if (showPayModal && !isProcessing) {
      e.preventDefault();
      handleFinalizeSale();
    }
  }, { scope: 'pay_modal' });

  useEffect(() => {
    loadData();
    caisseService.getActiveSession().then(setActiveSession);
    const last = printerService.getLastReceipt();
    if (last) setLastReceipt(last);
  }, []);


  const loadData = async () => {
    const prods = await productService.getProducts();
    setProducts(prods);
    const custs = await customerService.getCustomers();
    setCustomers(custs);
  };

  // Filtrage des produits
  const filteredProducts = products.filter(p => {
    const matchesCategory = selectedCategory === 'ALL' || p.category_id === selectedCategory;
    if (!matchesCategory) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase().trim();
    return (
      p.barcode.toLowerCase() === q ||
      p.sku.toLowerCase() === q ||
      p.name_fr.toLowerCase().includes(q) ||
      p.name_ar.toLowerCase().includes(q) ||
      (p.variant && p.variant.toLowerCase().includes(q))
    );
  });

  const addToCart = (product: Product) => {
    if (product.current_stock <= 0) {
      showToast(
        language === 'ar'
          ? `نفاد الكمية لـ ${product.name_ar || product.name_fr}`
          : `Rupture de stock pour ${product.name_fr}`,
        'error'
      );
      return;
    }

    setCart(prev => {
      const existing = prev.find(i => i.productId === product.id);
      if (existing) {
        if (existing.quantity >= product.current_stock) {
          showToast(
            language === 'ar'
              ? `تم الوصول إلى أقصى مخزون (${product.current_stock} وحدة)`
              : `Stock maximum atteint (${product.current_stock} unités)`,
            'warning'
          );
          return prev;
        }
        return prev.map(i =>
          i.productId === product.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      const effectivePrice = product.discount_price ?? product.selling_price_ttc ?? product.selling_price ?? 0;
      return [
        ...prev,
        {
          productId: product.id,
          name: language === 'ar' ? product.name_ar : product.name_fr,
          sku: product.sku,
          quantity: 1,
          unitPrice: effectivePrice,
          discountAmount: 0,
          maxStock: product.current_stock
        }
      ];
    });
  };

  // Continuous Barcode Scanning Handler
  const processBarcode = async (rawCode: string) => {
    const code = rawCode.trim();
    if (!code) return;

    // Clear and reset the dedicated scanner input immediately so the next scan is ready
    setBarcodeInput('');
    if (barcodeInputRef.current) {
      barcodeInputRef.current.value = '';
    }

    // 1. Search in in-memory products state (instant)
    const codeLower = code.toLowerCase();
    let matched = products.find(
      p =>
        (p.barcode && p.barcode.toLowerCase() === codeLower) ||
        (p.sku && p.sku.toLowerCase() === codeLower) ||
        (p.additional_barcodes && p.additional_barcodes.some(b => b.toLowerCase() === codeLower))
    );

    // 2. If not found in state, search authoritative SQLite database via productService
    if (!matched) {
      try {
        const dbMatched = await productService.findByBarcode(code);
        if (dbMatched) {
          matched = dbMatched;
          setProducts(prev => prev.some(p => p.id === dbMatched.id) ? prev : [...prev, dbMatched]);
        }
      } catch (err) {
        console.warn('Error querying product by barcode:', err);
      }
    }

    // 3. If found, add to cart (or increment quantity if already in cart)
    if (matched) {
      addToCart(matched);
      showToast(
        language === 'ar'
          ? `تمت إضافة ${matched.name_ar || matched.name_fr}`
          : `${matched.name_fr} ajouté au panier`,
        'success'
      );
    } else {
      // 4. Non-blocking warning notification
      showToast(
        language === 'ar'
          ? `المنتج غير موجود: ${code}`
          : `Article introuvable : ${code}`,
        'warning'
      );
    }

    // Keep dedicated scanner input ready and focused
    requestAnimationFrame(() => {
      if (!isAnyModalOpen) {
        barcodeInputRef.current?.focus();
      }
    });
  };

  const updateQuantity = (productId: string, delta: number) => {
    const item = cart.find(i => i.productId === productId);
    if (item && item.quantity + delta > item.maxStock) {
      showToast(`Stock maximum disponible : ${item.maxStock}`, 'warning');
      return;
    }

    setCart(prev =>
      prev
        .map(i => {
          if (i.productId === productId) {
            const newQty = i.quantity + delta;
            if (newQty <= 0) return null;
            return { ...i, quantity: newQty };
          }
          return i;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const updateQuantityExact = (productId: string, newQty: number) => {
    if (newQty <= 0) {
      removeItem(productId);
      return;
    }

    const item = cart.find(i => i.productId === productId);
    if (item && newQty > item.maxStock) {
      showToast(`Stock maximum disponible : ${item.maxStock}`, 'warning');
    }

    setCart(prev =>
      prev.map(i => {
        if (i.productId === productId) {
          if (newQty > i.maxStock) {
            return { ...i, quantity: i.maxStock };
          }
          return { ...i, quantity: newQty };
        }
        return i;
      })
    );
  };

  const removeItem = (productId: string) => {
    setCart(prev => {
      const newCart = prev.filter(i => i.productId !== productId);
      // Adjust selection if we removed the selected item
      if (selectedCartIndex >= newCart.length) {
        setSelectedCartIndex(newCart.length - 1);
      }
      return newCart;
    });
  };

  // --- KEYBOARD & SCANNER HOOKS ---

  // Dedicated permanent barcode scanner hook (always active when POS screen is open)
  useScanner((barcode) => {
    if (isAnyModalOpen) return;
    processBarcode(barcode);
  }, !isAnyModalOpen);

  // Cart Navigation Scope (Active when POS is active)
  useShortcut('ArrowUp', (e) => {
    if (!isAnyModalOpen && cart.length > 0) {
      e.preventDefault();
      setSelectedCartIndex(prev => Math.max(0, prev - 1));
    }
  }, { scope: 'pos' });

  useShortcut('ArrowDown', (e) => {
    if (!isAnyModalOpen && cart.length > 0) {
      e.preventDefault();
      setSelectedCartIndex(prev => Math.min(cart.length - 1, prev + 1));
    }
  }, { scope: 'pos' });

  useShortcut('q', (e) => {
    if (!isAnyModalOpen) {
      e.preventDefault();
      barcodeInputRef.current?.focus();
    }
  }, { scope: 'pos' });

  useShortcut('Tab', (e) => {
    if (!isAnyModalOpen) {
      e.preventDefault();
      handleOpenPay();
    }
  }, { scope: 'pos' });

  useShortcut('+', (e) => {
    if (!isAnyModalOpen && cart.length > 0 && selectedCartIndex >= 0) {
      if (!(document.activeElement instanceof HTMLInputElement)) {
        e.preventDefault();
        updateQuantity(cart[selectedCartIndex].productId, 1);
      }
    }
  }, { scope: 'pos' });

  useShortcut('-', (e) => {
    if (!isAnyModalOpen && cart.length > 0 && selectedCartIndex >= 0) {
      if (!(document.activeElement instanceof HTMLInputElement)) {
        e.preventDefault();
        updateQuantity(cart[selectedCartIndex].productId, -1);
      }
    }
  }, { scope: 'pos' });

  // Keep selection valid when cart changes
  useEffect(() => {
    if (cart.length > 0 && selectedCartIndex === -1) {
      setSelectedCartIndex(cart.length - 1); // Auto-select latest added item
    } else if (cart.length === 0) {
      setSelectedCartIndex(-1);
    }
  }, [cart.length]);

  // Extract unique categories from loaded products dynamically
  const categoryPairs = Array.from(
    new Map(
      products
        .filter(p => p.category_id && p.category_name)
        .map(p => [p.category_id, p.category_name] as [string, string])
    )
  );

  const categoriesList = [
    { id: 'ALL', name: language === 'ar' ? 'جميع المنتجات' : 'Tous les articles' },
    ...categoryPairs.map(([id, name]) => ({ id, name }))
  ];

  // Calculs du panier
  const subtotal = cart.reduce(
    (sum, i) => CurrencyUtil.add(sum, CurrencyUtil.multiply(i.unitPrice - i.discountAmount, i.quantity)),
    0
  );
  const totalTTC = subtotal;

  // Raccourcis coupures dinars algériens
  const tenderedAmount = parseFloat(tenderedInput) || totalTTC;
  const changeGiven = Math.max(0, CurrencyUtil.subtract(tenderedAmount, totalTTC));

  const handleOpenPay = () => {
    if (cart.length === 0) {
      showToast(t('pos.cartEmpty'), 'warning');
      return;
    }
    setTenderedInput(totalTTC.toString());
    setShowPayModal(true);
  };

  const handleHoldCart = () => {
    if (cart.length === 0) return;
    const newHeld = {
      id: Math.random().toString(36).substring(7),
      items: [...cart],
      customerId: selectedCustomerId,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    setHeldCarts([...heldCarts, newHeld]);
    setCart([]);
    setSelectedCustomerId('');
    showToast('Panier mis en attente', 'info');
  };

  const handleResumeCart = (heldId: string) => {
    const held = heldCarts.find(h => h.id === heldId);
    if (!held) return;
    
    if (cart.length > 0) {
      // Put current on hold automatically to avoid losing it
      const newHeld = {
        id: Math.random().toString(36).substring(7),
        items: [...cart],
        customerId: selectedCustomerId,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setHeldCarts(prev => [...prev.filter(h => h.id !== heldId), newHeld]);
    } else {
      setHeldCarts(prev => prev.filter(h => h.id !== heldId));
    }

    setCart(held.items);
    setSelectedCustomerId(held.customerId);
    setShowHeldSalesPanel(false);
    showToast('Panier repris', 'info');
  };

  const handleRemoveHeldCart = (heldId: string) => {
    setHeldCarts(prev => prev.filter(h => h.id !== heldId));
    if (heldCarts.length <= 1) setShowHeldSalesPanel(false);
    showToast('Panier supprimé', 'info');
  };

  // Finalisation de l'encaissement
  const handleFinalizeSale = async () => {
    if (isProcessing) return;
    if (!user) {
      showToast('Aucun caissier actif sélectionné', 'error');
      return;
    }

    if (paymentMethod === 'CASH' && tenderedAmount < totalTTC) {
      showToast(`Montant insuffisant (${tenderedAmount} DA reçu, requis: ${totalTTC} DA)`, 'error');
      return;
    }

    if ((paymentMethod === 'CIB' || paymentMethod === 'EDAHABIA') && !tpeReference.trim()) {
      showToast('Veuillez saisir le N° d\'autorisation / transaction TPE.', 'warning');
      return;
    }

    if (paymentMethod === 'CREDIT' && !selectedCustomerId) {
      showToast('Un client doit être sélectionné pour une vente à crédit.', 'error');
      return;
    }

    setIsProcessing(true);
    try {
      const selectedCustomer = customers.find(c => c.id === selectedCustomerId);

      const sale = await checkoutService.processCheckout({
        cashierId: user.id,
        cashierName: user.name,
        sessionId: activeSession?.id,
        customerId: selectedCustomerId || undefined,
        customerName: selectedCustomer?.name,
        items: cart,
        payments: [
          {
            method: paymentMethod,
            amount: totalTTC,
            tenderedAmount: paymentMethod === 'CASH' ? tenderedAmount : totalTTC,
            changeGiven: paymentMethod === 'CASH' ? changeGiven : 0,
            tpeAuthReference: tpeReference.trim() || undefined
          }
        ]
      });

      // Impression automatique du ticket
      const receiptData = {
        storeNameFr: 'Aquadro Nutrition Algérie',
        storeNameAr: 'أبكس كور نوتريشن الجزائر',
        storeAddress: 'Dely Ibrahim, Alger',
        storePhone: '0550 12 34 56',
        rcNumber: '16/00-0987654B19',
        nifNumber: '001916012345678',
        fiscalRegime: 'IFU' as const,
        receiptNumber: sale.receipt_number,
        dateTime: new Date().toLocaleString(),
        cashierName: user.name,
        customerName: selectedCustomer?.name,
        items: cart.map(i => ({
          name: i.name,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          total: CurrencyUtil.multiply(i.unitPrice, i.quantity)
        })),
        subtotalHT: totalTTC,
        taxAmount: 0,
        taxRate: 0,
        totalTTC: totalTTC,
        paymentMethod,
        tenderedAmount: paymentMethod === 'CASH' ? tenderedAmount : totalTTC,
        changeGiven: paymentMethod === 'CASH' ? changeGiven : 0,
        paperWidth: '80mm' as const
      };

      const autoPrint = printerService.getConfig().autoPrint !== false;
      await printerService.printReceipt(receiptData, autoPrint);
      setLastReceipt(receiptData);
      setShowReceiptModal(true);

      showToast(`Vente ${sale.receipt_number} validée avec succès !`, 'success');
      setCart([]);
      setShowPayModal(false);
      setTpeReference('');
      setSelectedCustomerId('');
      await loadData();
    } catch (err: any) {
      showToast(`Erreur d'encaissement : ${err.message}`, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div onClick={handleContainerClick} className="flex-1 flex overflow-hidden bg-gray-100 text-gray-800 text-xs select-none">
      {/* ========================================================================= */}
      {/* COLONNE GAUCHE : RECHERCHE + CATÉGORIES + LISTE DES PRODUITS              */}
      {/* ========================================================================= */}
      <div className="flex-1 flex flex-col border-r border-gray-200 bg-white overflow-hidden">
        {/* Barre de Recherche Rapide & Scanner */}
        <div className="p-2 border-b border-gray-200 bg-gray-50 flex flex-wrap items-center gap-2">
          {/* Entrée Dédiée Scanner Code-Barres USB (Permanente & Auto-focusée) */}
          <div className="flex-1 min-w-[220px] relative flex items-center">
            <Barcode className="w-4 h-4 text-emerald-600 absolute left-2.5 z-10 pointer-events-none" />
            <input
              ref={barcodeInputRef}
              id="pos-barcode-input"
              data-barcode-scanner="true"
              type="text"
              placeholder={
                language === 'ar'
                  ? 'السكانر جاهز (امسح الباركود مباشرة)...'
                  : 'Scanner USB prêt (scannez directement)...'
              }
              value={barcodeInput}
              onChange={e => setBarcodeInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (barcodeInput.trim()) {
                    processBarcode(barcodeInput.trim());
                  }
                }
              }}
              className="w-full bg-emerald-50/50 border border-emerald-300 rounded pl-8 pr-24 py-1.5 text-xs text-gray-900 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 font-medium placeholder-gray-500 shadow-sm"
              autoComplete="off"
              autoCorrect="off"
              spellCheck="false"
            />
            {/* Indicateur de disponibilité permanente du scanner USB */}
            <div className="absolute right-2 flex items-center gap-1.5 pointer-events-none px-1.5 py-0.5 rounded bg-emerald-100 border border-emerald-200 text-emerald-800 text-[10px] font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="hidden sm:inline">{language === 'ar' ? 'السكانر نشط' : 'Scanner actif'}</span>
            </div>
          </div>

          {/* Recherche Manuelle Catalogue (Par nom, SKU, saveur) */}
          <div className="flex-1 min-w-[180px] relative flex items-center">
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 z-10 pointer-events-none" />
            <input
              ref={manualSearchInputRef}
              id="pos-manual-search-input"
              type="text"
              placeholder={
                language === 'ar'
                  ? 'بحث يدوي بالاسم أو المرجع...'
                  : 'Recherche manuelle par nom/réf...'
              }
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Escape') {
                  setSearch('');
                  barcodeInputRef.current?.focus();
                } else if (e.key === 'Enter') {
                  e.preventDefault();
                  if (filteredProducts.length === 1) {
                    addToCart(filteredProducts[0]);
                    setSearch('');
                    barcodeInputRef.current?.focus();
                  }
                }
              }}
              className="w-full bg-white border border-gray-300 rounded pl-8 pr-7 py-1.5 text-xs text-gray-900 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 font-normal placeholder-gray-400 shadow-sm"
              autoComplete="off"
              autoCorrect="off"
              spellCheck="false"
            />
            {search && (
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  barcodeInputRef.current?.focus();
                }}
                className="absolute right-2 text-gray-400 hover:text-gray-600 text-xs px-1"
                title="Effacer la recherche"
              >
                ✕
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => setShowCameraScanner(true)}
            className="flex items-center space-x-1 px-2.5 py-1.5 rounded bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 font-semibold text-xs transition-colors shadow-sm"
            title="Ouvrir la caméra comme scanner d'appoint"
          >
            <Camera className="w-3.5 h-3.5 text-blue-600" />
            <span>{language === 'ar' ? 'كاميرا' : 'Caméra'}</span>
          </button>
          {heldCarts.length > 0 && (
            <button
              type="button"
              onClick={() => setShowHeldSalesPanel(true)}
              className="flex items-center space-x-1 px-2.5 py-1.5 rounded bg-amber-100 hover:bg-amber-200 border border-amber-300 text-amber-900 font-semibold"
            >
              <Clock className="w-3.5 h-3.5" />
              <span>En attente ({heldCarts.length})</span>
            </button>
          )}
          {lastReceipt && (
            <button
              type="button"
              onClick={() => setShowReceiptModal(true)}
              className="flex items-center space-x-1 px-2.5 py-1.5 rounded bg-white hover:bg-gray-100 border border-gray-300 text-gray-700 font-semibold text-xs transition-colors shadow-sm"
              title="Afficher et réimprimer le dernier ticket de caisse"
            >
              <Printer className="w-3.5 h-3.5 text-blue-600" />
              <span>{language === 'ar' ? 'آخر تذكرة' : 'Dernier Reçu'}</span>
            </button>
          )}
        </div>

        {/* Onglets Catégories Produits (Filtre rapide) */}
        <div className="px-2 py-1.5 border-b border-gray-200 bg-white flex items-center space-x-1 overflow-x-auto text-[11px]">
          {categoriesList.map((cat, index) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-2.5 py-1 rounded border font-medium whitespace-nowrap transition-colors ${
                selectedCategory === cat.id
                  ? 'bg-blue-600 border-blue-600 text-white'
                  : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Grille / Liste Dense des Articles */}
        <div className="flex-1 overflow-y-auto p-2 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
          {filteredProducts.map(p => {
            const isOutOfStock = p.current_stock <= 0;
            return (
              <button
                key={p.id}
                onClick={() => addToCart(p)}
                disabled={isOutOfStock}
                className={`p-2 rounded border text-left flex flex-col justify-between transition-all ${
                  isOutOfStock
                    ? 'bg-gray-50 border-gray-200 opacity-50 cursor-not-allowed'
                    : 'bg-white hover:border-blue-500 hover:shadow-sm border-gray-200'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between">
                    <span className="font-semibold text-gray-900 leading-tight line-clamp-2">
                      {language === 'ar' ? p.name_ar : p.name_fr}
                    </span>
                  </div>
                  {p.variant && (
                    <span className="text-[10px] text-gray-500 block mt-0.5">{p.variant}</span>
                  )}
                  <span className="text-[10px] text-gray-400 font-mono block">{p.barcode}</span>
                </div>

                <div className="mt-2 pt-1 border-t border-gray-100 flex items-center justify-between">
                  <span className="font-bold text-gray-900 text-xs">
                    {CurrencyUtil.formatDZD(p.selling_price_ttc)}
                  </span>
                  <span
                    className={`text-[10px] font-mono px-1 rounded ${
                      p.current_stock <= p.min_stock_alert
                        ? 'bg-amber-50 text-amber-700 font-bold border border-amber-200'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    Qté: {p.current_stock}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* COLONNE DROITE : PANIER DE VENTE & TOTAUX                                  */}
      {/* ========================================================================= */}
      <div className="w-80 md:w-96 bg-gray-50 flex flex-col justify-between overflow-hidden">
        {/* Entête Panier & Client */}
        <div className="p-2 border-b border-gray-200 bg-white">
          <div className="flex items-center justify-between mb-1.5">
            <span className="font-bold text-gray-900 uppercase tracking-wider text-[11px]">
              {t('pos.cartTitle')} ({cart.length})
            </span>
            <div className="flex items-center space-x-1">
              <button
                onClick={handleHoldCart}
                disabled={cart.length === 0}
                className="px-2 py-0.5 text-[11px] font-medium rounded border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 disabled:opacity-50"
              >
                {t('pos.holdSale')}
              </button>
              <button
                onClick={() => setCart([])}
                disabled={cart.length === 0}
                className="px-2 py-0.5 text-[11px] font-medium rounded border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 disabled:opacity-50"
              >
                {t('pos.clearCart')}
              </button>
            </div>
          </div>

          {/* Client associé */}
          <div className="flex items-center space-x-1">
            <Users className="w-3.5 h-3.5 text-gray-400" />
            <select
              value={selectedCustomerId}
              onChange={e => setSelectedCustomerId(e.target.value)}
              className="flex-1 bg-gray-50 border border-gray-200 rounded px-2 py-1 text-xs text-gray-800 focus:outline-none"
            >
              <option value="">Client comptoir de passage</option>
              {customers.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.phone ? `(${c.phone})` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Lignes du Panier */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-4 text-gray-400">
              <Barcode className="w-8 h-8 text-gray-300 mb-2" />
              <p className="text-xs">{t('pos.cartEmpty')}</p>
            </div>
          ) : (
            cart.map((item, index) => {
              const isSelected = index === selectedCartIndex;
              return (
                <div
                  key={item.productId}
                  className={`p-2 rounded border transition-colors flex items-center justify-between ${
                    isSelected ? 'bg-blue-50 border-blue-400 shadow-sm' : 'border-gray-200 bg-white'
                  }`}
                  onClick={() => setSelectedCartIndex(index)}
                >
                  <div className="flex-1 min-w-0 pr-2">
                    <div className="font-semibold text-gray-900 truncate">{item.name}</div>
                    <div className="text-[11px] text-gray-500 font-mono">
                      {CurrencyUtil.formatDZD(item.unitPrice)}
                    </div>
                  </div>

                  <div className="flex items-center space-x-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        updateQuantity(item.productId, -1);
                      }}
                      className="w-6 h-6 rounded border border-gray-300 bg-gray-50 hover:bg-gray-100 flex items-center justify-center text-gray-700 font-bold"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    
                    <input
                      type="number"
                      min={1}
                      max={item.maxStock}
                      value={item.quantity}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        if (!isNaN(val)) {
                          updateQuantityExact(item.productId, val);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          barcodeInputRef.current?.focus();
                        }
                      }}
                      className="w-12 text-center font-bold text-gray-900 font-mono border border-gray-300 rounded py-0.5 text-xs focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white"
                      title="Modifier la quantité directement"
                    />
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        updateQuantity(item.productId, 1);
                      }}
                      className="w-6 h-6 rounded border border-gray-300 bg-gray-50 hover:bg-gray-100 flex items-center justify-center text-gray-700 font-bold"
                    >
                      <Plus className="w-3 h-3" />
                    </button>

                    <div className="w-20 text-right font-bold text-gray-900 font-mono text-xs pl-2">
                      {CurrencyUtil.formatDZD(
                        CurrencyUtil.multiply(item.unitPrice - item.discountAmount, item.quantity)
                      )}
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeItem(item.productId);
                      }}
                      className="p-1 hover:text-red-600 text-gray-400 ml-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Panneau des Totaux & Bouton Paiement */}
        <div className="p-3 border-t border-gray-200 bg-white space-y-2">
          <div className="space-y-1 text-xs">
            <div className="flex justify-between text-gray-600">
              <span>{t('pos.subtotal')}</span>
              <span className="font-mono">{CurrencyUtil.formatDZD(subtotal)}</span>
            </div>
            <div className="flex justify-between text-[11px] text-gray-500 italic">
              <span>{t('pos.ifuExempt')}</span>
              <span>0 DA</span>
            </div>
            <div className="flex justify-between items-baseline pt-1 border-t border-gray-200">
              <span className="font-bold text-sm text-gray-900">{t('pos.totalTTC')}</span>
              <span className="font-black text-lg text-blue-700 font-mono">
                {CurrencyUtil.formatDZD(totalTTC)}
              </span>
            </div>
          </div>

          <button
            onClick={handleOpenPay}
            disabled={cart.length === 0}
            className="w-full py-3 rounded bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-sm tracking-wide shadow-sm flex items-center justify-center space-x-2 transition-colors"
          >
            <span>{t('pos.payButton')}</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL DE RÈGLEMENT RAPIDE (Espèces, CIB, Edahabia, BaridiMob)              */}
      {/* ========================================================================= */}
      {showPayModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white border border-gray-200 rounded-lg shadow-xl w-full max-w-md overflow-hidden animate-in fade-in">
            <div className="p-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
              <span className="font-bold text-gray-900 text-sm">Règlement de la Vente</span>
              <span className="font-mono font-bold text-blue-700 text-sm">
                {CurrencyUtil.formatDZD(totalTTC)}
              </span>
            </div>

            <div className="p-4 space-y-3">
              {/* Choix du mode de paiement */}
              <div className="grid grid-cols-4 gap-1.5">
                {[
                  { id: 'CASH', label: 'Espèces', icon: <Banknote className="w-4 h-4" /> },
                  { id: 'CIB', label: 'TPE CIB', icon: <CreditCard className="w-4 h-4" /> },
                  { id: 'EDAHABIA', label: 'Edahabia', icon: <CreditCard className="w-4 h-4" /> },
                  { id: 'BARIDIMOB', label: 'BaridiMob', icon: <QrCode className="w-4 h-4" /> },
                  { id: 'CREDIT', label: 'Crédit (À terme)', icon: <Users className="w-4 h-4" /> }
                ].map(m => (
                  <button
                    key={m.id}
                    onClick={() => setPaymentMethod(m.id as PaymentMethod)}
                    className={`p-2 rounded border text-center flex flex-col items-center justify-center space-y-1 ${
                      paymentMethod === m.id
                        ? 'bg-blue-50 border-blue-600 text-blue-700 font-bold'
                        : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {m.icon}
                    <span className="text-[10px]">{m.label}</span>
                  </button>
                ))}
              </div>

              {/* Si Espèces : Coupures et Monnaie */}
              {paymentMethod === 'CASH' && (
                <div className="space-y-2 pt-2 border-t border-gray-100">
                  <div>
                    <label className="text-[11px] font-semibold text-gray-600 block mb-1">
                      {t('pos.tenderedAmount')} (DZD)
                    </label>
                    <input
                      type="number"
                      value={tenderedInput}
                      onChange={e => setTenderedInput(e.target.value)}
                      className="w-full bg-white border border-gray-300 rounded px-2.5 py-1.5 font-mono text-sm font-bold text-gray-900 focus:outline-none focus:border-blue-600"
                    />
                  </div>

                  {/* Boutons Coupures Algériennes Rapides */}
                  <div className="flex space-x-1">
                    {[1000, 2000, 5000, 10000].map(val => (
                      <button
                        key={val}
                        onClick={() => setTenderedInput(val.toString())}
                        className="flex-1 py-1 rounded bg-gray-100 hover:bg-gray-200 border border-gray-200 text-[11px] font-mono font-semibold text-gray-800"
                      >
                        {val} DA
                      </button>
                    ))}
                  </div>

                  <div className="p-2 rounded bg-gray-50 border border-gray-200 flex justify-between items-center text-xs">
                    <span className="text-gray-600">{t('pos.change')} :</span>
                    <span className="font-mono font-bold text-emerald-700 text-sm">
                      {CurrencyUtil.formatDZD(changeGiven)}
                    </span>
                  </div>
                </div>
              )}

              {/* Si TPE CIB / Edahabia : Saisie de la référence ticket TPE */}
              {(paymentMethod === 'CIB' || paymentMethod === 'EDAHABIA') && (
                <div className="space-y-2 pt-2 border-t border-gray-100">
                  <div className="p-2 rounded bg-blue-50 border border-blue-200 text-[11px] text-blue-900 leading-snug">
                    Veuillez composer le montant <strong>{CurrencyUtil.formatDZD(totalTTC)}</strong> sur le terminal TPE physique. Une fois le ticket émis par le terminal, saisissez le N° d'autorisation ci-dessous :
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-gray-600 block mb-1">
                      {t('pos.enterTpeRef')} *
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: TPE-987654 ou REF-00123"
                      value={tpeReference}
                      onChange={e => setTpeReference(e.target.value)}
                      className="w-full bg-white border border-gray-300 rounded px-2.5 py-1.5 font-mono text-xs text-gray-900 focus:outline-none focus:border-blue-600"
                    />
                  </div>
                </div>
              )}

              {/* Si BaridiMob : Affichage QR */}
              {paymentMethod === 'BARIDIMOB' && (
                <div className="space-y-2 pt-2 border-t border-gray-100 text-center">
                  <div className="w-24 h-24 mx-auto bg-gray-100 border border-gray-300 rounded flex items-center justify-center font-mono text-[10px] text-gray-500">
                    [QR BaridiMob]
                  </div>
                  <p className="text-[11px] text-gray-500">
                    Faites scanner le QR Code ci-dessus via l'application BaridiMob du client.
                  </p>
                </div>
              )}

              {/* Si Crédit : Vérifier qu'un client est sélectionné */}
              {paymentMethod === 'CREDIT' && (
                <div className="space-y-2 pt-2 border-t border-gray-100">
                  <div className={`p-2 rounded border text-[11px] leading-snug ${selectedCustomerId ? 'bg-amber-50 border-amber-200 text-amber-900' : 'bg-red-50 border-red-200 text-red-900'}`}>
                    {selectedCustomerId 
                      ? `Le montant de ${CurrencyUtil.formatDZD(totalTTC)} sera ajouté à la dette du client. Un "Bon de Crédit" sera imprimé.`
                      : `⚠ Vous devez sélectionner un client (en haut) pour enregistrer une vente à crédit !`}
                  </div>
                </div>
              )}
            </div>

            <div className="p-3 border-t border-gray-200 bg-gray-50 flex space-x-2">
              <button
                type="button"
                onClick={() => setShowPayModal(false)}
                className="flex-1 py-2 rounded bg-white hover:bg-gray-100 border border-gray-300 text-gray-700 font-medium text-xs"
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                onClick={handleFinalizeSale}
                disabled={isProcessing}
                className="flex-1 py-2 rounded bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs transition-colors flex items-center justify-center space-x-1"
              >
                <CheckCircle className="w-4 h-4" />
                <span>{isProcessing ? 'Validation...' : t('pos.confirmPayment')}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL APERÇU ET IMPRESSION DU TICKET DE CAISSE                            */}
      {/* ========================================================================= */}
      <ReceiptModal
        isOpen={showReceiptModal}
        onClose={() => setShowReceiptModal(false)}
        receiptData={lastReceipt}
        onNewSale={() => {
          setShowReceiptModal(false);
          barcodeInputRef.current?.focus();
        }}
      />

      {/* ========================================================================= */}
      {/* PANNEAU DES VENTES EN ATTENTE (HELD SALES PANEL)                            */}
      {/* ========================================================================= */}
      {showHeldSalesPanel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white border border-gray-200 rounded-lg shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in">
            <div className="p-3 border-b border-gray-200 bg-amber-50 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Clock className="w-5 h-5 text-amber-600" />
                <span className="font-bold text-amber-900 text-sm">Paniers en attente ({heldCarts.length})</span>
              </div>
              <button onClick={() => setShowHeldSalesPanel(false)} className="text-amber-900 hover:text-amber-700 font-bold">
                ✕
              </button>
            </div>
            
            <div className="p-4 space-y-3 max-h-[60vh] overflow-y-auto">
              {heldCarts.length === 0 ? (
                <div className="text-center text-gray-500 py-4">Aucun panier en attente.</div>
              ) : (
                heldCarts.map(hc => (
                  <div key={hc.id} className="p-3 border border-gray-200 rounded-lg flex justify-between items-center bg-gray-50 hover:bg-gray-100 transition-colors">
                    <div>
                      <div className="text-sm font-bold text-gray-800">
                        {hc.customerId ? customers.find(c => c.id === hc.customerId)?.name : 'Client Comptoir'}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        Mis en attente à <span className="font-mono">{hc.time}</span> • {hc.items.length} articles
                      </div>
                      <div className="text-xs font-mono font-bold text-blue-700 mt-1">
                        Total : {CurrencyUtil.formatDZD(hc.items.reduce((sum, i) => sum + (i.unitPrice * i.quantity), 0))}
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      <button 
                        onClick={() => handleRemoveHeldCart(hc.id)} 
                        className="px-3 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded font-bold text-xs transition-colors"
                        title="Supprimer définitivement"
                      >
                        ✕
                      </button>
                      <button 
                        onClick={() => handleResumeCart(hc.id)} 
                        className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded font-bold text-xs shadow-sm transition-colors"
                      >
                        Reprendre
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
            
            <div className="p-3 border-t border-gray-200 bg-gray-50 flex justify-end">
              <button
                type="button"
                onClick={() => setShowHeldSalesPanel(false)}
                className="px-4 py-2 rounded bg-white hover:bg-gray-100 border border-gray-300 text-gray-700 font-medium text-xs"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Scanner Modal Pop-up pour le POS */}
      {showCameraScanner && (
        <CameraScanner
          onScanSuccess={(scannedBarcode) => {
            const matched = products.find(p => p.barcode.trim() === scannedBarcode.trim() || p.sku.trim() === scannedBarcode.trim());
            if (matched) {
              addToCart(matched);
              showToast(`${language === 'ar' ? matched.name_ar : matched.name_fr} ajouté au panier`, 'success');
            } else {
              showToast(`Article introuvable : ${scannedBarcode}`, 'warning');
            }
          }}
          onClose={() => setShowCameraScanner(false)}
        />
      )}
    </div>
  );
};
