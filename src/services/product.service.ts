// Aquadro POS Algérie V2 — Service de Gestion du Catalogue Produits
// Prise en charge des compléments alimentaires, détection des doublons codes-barres/SKU et conversions de conditionnement

import { db } from '../db/sqlite';
import { Product, ProductBatch, Category, Brand } from '../types/database';

export interface CreateProductInput {
  sku: string;
  barcode: string;
  additional_barcodes?: string[];
  name_fr: string;
  name_ar: string;
  category_id?: string;
  brand_id?: string;
  variant?: string;
  size_weight?: string;
  unit_of_measure?: 'UNIT' | 'BOX' | 'CARTON' | 'PACK';
  box_conversion_ratio?: number;
  purchase_cost: number;
  selling_price_ttc: number;
  min_selling_price_ttc?: number;
  tva_rate?: number;
  current_stock?: number;
  min_stock_alert?: number;
  initial_batch_number?: string;
  initial_expiration_date?: string;
}

export class ProductService {
  private static instance: ProductService;

  private constructor() {}

  public static getInstance(): ProductService {
    if (!ProductService.instance) {
      ProductService.instance = new ProductService();
    }
    return ProductService.instance;
  }

  // Liste de tous les produits avec leurs catégories et marques
  public async getProducts(): Promise<Product[]> {
    const products = await db.select<Product>(
      'SELECT * FROM products WHERE is_active = 1'
    );
    const categories = await db.select<Category>('SELECT * FROM categories');
    const brands = await db.select<Brand>('SELECT * FROM brands');
    const allBatches = await db.select<ProductBatch>('SELECT * FROM product_batches ORDER BY expiration_date ASC');

    const catMap = new Map(categories.map(c => [c.id, c.name_fr]));
    const brandMap = new Map(brands.map(b => [b.id, b.name]));

    return products.map(p => ({
      ...p,
      name_fr: p.name_fr || (p as any).name,
      purchase_cost: p.purchase_cost !== undefined ? p.purchase_cost : (p as any).purchase_price,
      selling_price_ttc: p.selling_price_ttc !== undefined ? p.selling_price_ttc : (p as any).selling_price,
      category_name: p.category_id ? catMap.get(p.category_id) : undefined,
      brand_name: p.brand_id ? brandMap.get(p.brand_id) : undefined,
      batches: allBatches.filter(b => b.product_id === p.id)
    }));
  }

  // Récupérer un produit par son identifiant
  public async getProductById(id: string): Promise<(Product & { purchase_price?: number; selling_price?: number }) | null> {
    const products = await db.select<Product>('SELECT * FROM products WHERE id = ?', [id]);
    if (products.length === 0) return null;
    const p = products[0];
    const purchaseCost = p.purchase_cost !== undefined ? p.purchase_cost : (p as any).purchase_price;
    const sellingPrice = p.selling_price_ttc !== undefined ? p.selling_price_ttc : (p as any).selling_price;
    return {
      ...p,
      name_fr: p.name_fr || (p as any).name,
      purchase_cost: purchaseCost,
      selling_price_ttc: sellingPrice,
      purchase_price: purchaseCost,
      selling_price: sellingPrice
    };
  }

  // Recherche directe d'un produit par code-barres ou référence SKU
  public async findByBarcode(code: string): Promise<Product | null> {
    const trimmed = code.trim();
    if (!trimmed) return null;
    const products = await db.select<Product>(
      'SELECT id FROM products WHERE (barcode = ? OR sku = ?) AND is_active = 1 LIMIT 1',
      [trimmed, trimmed]
    );
    if (products.length === 0) return null;
    return this.getProductById(products[0].id);
  }

  // Recherche par code-barres, SKU, nom ou saveur
  public async searchProducts(query: string): Promise<Product[]> {
    const list = await this.getProducts();
    if (!query.trim()) return list;

    const q = query.toLowerCase().trim();
    return list.filter(p =>
      p.barcode.toLowerCase() === q ||
      p.sku.toLowerCase() === q ||
      p.name_fr.toLowerCase().includes(q) ||
      p.name_ar.toLowerCase().includes(q) ||
      (p.variant && p.variant.toLowerCase().includes(q)) ||
      (p.brand_name && p.brand_name.toLowerCase().includes(q))
    );
  }

  // Création d'un produit avec vérification d'unicité
  public async createProduct(input: CreateProductInput): Promise<Product> {
    // Vérification de doublon sur le code-barres
    const existingBarcode = await db.select<Product>(
      'SELECT id FROM products WHERE barcode = ?',
      [input.barcode.trim()]
    );
    if (existingBarcode.length > 0) {
      throw new Error(`Un produit existe déjà avec le code-barres : ${input.barcode}`);
    }

    // Vérification de doublon sur le SKU
    const existingSku = await db.select<Product>(
      'SELECT id FROM products WHERE sku = ?',
      [input.sku.trim()]
    );
    if (existingSku.length > 0) {
      throw new Error(`Un produit existe déjà avec la référence SKU : ${input.sku}`);
    }

    const productId = `prod-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date().toISOString();
    const stock = input.current_stock ?? 0;

    const product: Product = {
      id: productId,
      sku: input.sku.trim(),
      barcode: input.barcode.trim(),
      additional_barcodes: input.additional_barcodes,
      name_fr: input.name_fr.trim(),
      name_ar: input.name_ar.trim() || input.name_fr.trim(),
      category_id: input.category_id,
      brand_id: input.brand_id,
      variant: input.variant,
      size_weight: input.size_weight,
      unit_of_measure: input.unit_of_measure || 'UNIT',
      box_conversion_ratio: input.box_conversion_ratio || 1.0,
      purchase_cost: input.purchase_cost,
      selling_price_ttc: input.selling_price_ttc,
      min_selling_price_ttc: input.min_selling_price_ttc ?? input.purchase_cost,
      tva_rate: input.tva_rate ?? 0.0,
      current_stock: stock,
      min_stock_alert: input.min_stock_alert ?? 5,
      is_active: 1,
      created_at: now,
      updated_at: now
    };

    await db.execute(
      `INSERT INTO products (
        id, sku, barcode, name_fr, name_ar, category_id, brand_id, variant,
        size_weight, unit_of_measure, box_conversion_ratio, purchase_cost,
        selling_price_ttc, min_selling_price_ttc, tva_rate, current_stock,
        min_stock_alert, is_active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        product.id, product.sku, product.barcode, product.name_fr, product.name_ar,
        product.category_id || null, product.brand_id || null, product.variant || null,
        product.size_weight || null, product.unit_of_measure, product.box_conversion_ratio,
        product.purchase_cost, product.selling_price_ttc, product.min_selling_price_ttc,
        product.tva_rate, product.current_stock, product.min_stock_alert,
        product.is_active, product.created_at, product.updated_at
      ]
    );

    // Si un lot initial et une date d'expiration sont spécifiés
    if (input.initial_batch_number && input.initial_expiration_date && stock > 0) {
      await db.execute(
        `INSERT INTO product_batches (
          id, product_id, batch_number, expiration_date, current_stock, purchase_cost, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          `batch-${Date.now()}`,
          product.id,
          input.initial_batch_number.trim(),
          input.initial_expiration_date,
          stock,
          product.purchase_cost,
          now
        ]
      );
    }

    return product;
  }

  // Mise à jour d'un produit existant
  public async updateProduct(id: string, updates: Partial<Product>): Promise<void> {
    const fields: string[] = [];
    const values: any[] = [];

    for (const [key, val] of Object.entries(updates)) {
      if (key !== 'id' && key !== 'created_at' && key !== 'batches' && key !== 'category_name' && key !== 'brand_name') {
        fields.push(`${key} = ?`);
        values.push(val);
      }
    }

    if (fields.length === 0) return;

    values.push(id);
    await db.execute(
      `UPDATE products SET ${fields.join(', ')}, updated_at = '${new Date().toISOString()}' WHERE id = ?`,
      values
    );
  }

  // Archivage / Suppression logique
  public async archiveProduct(id: string): Promise<void> {
    await db.execute('UPDATE products SET is_active = 0 WHERE id = ?', [id]);
  }
}

export const productService = ProductService.getInstance();
