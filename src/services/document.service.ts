// Aquadro POS Algérie V2 — Service de Gestion des Documents Commerciaux
// Numérotation séquentielle inviolable (Factures, Tickets, Avoirs, Bons de Livraison)

import { db } from '../db/sqlite';
import { DocumentType, DocumentRecord } from '../types/database';

export class DocumentService {
  private static instance: DocumentService;

  private constructor() {}

  public static getInstance(): DocumentService {
    if (!DocumentService.instance) {
      DocumentService.instance = new DocumentService();
    }
    return DocumentService.instance;
  }

  // Obtenir le prochain numéro séquentiel immuable
  public async getNextNumber(type: DocumentType): Promise<string> {
    const year = new Date().getFullYear();
    const rows = await db.select<{ last_sequence_number: number }>(
      'SELECT last_sequence_number FROM document_sequences WHERE document_type = ? AND current_year = ?',
      [type, year]
    );

    let next = 1;
    if (rows.length > 0) {
      next = rows[0].last_sequence_number + 1;
      await db.execute(
        'UPDATE document_sequences SET last_sequence_number = ? WHERE document_type = ? AND current_year = ?',
        [next, type, year]
      );
    } else {
      await db.execute(
        'INSERT INTO document_sequences (document_type, current_year, last_sequence_number) VALUES (?, ?, ?)',
        [type, year, next]
      );
    }

    const prefixes: Record<DocumentType, string> = {
      TICKET: 'TKT',
      FACTURE: 'FAC',
      AVOIR: 'AVO',
      BON_LIVRAISON: 'BL',
      COMMANDE: 'BC'
    };

    return `${prefixes[type]}-${year}-${next.toString().padStart(6, '0')}`;
  }

  // Enregistrer un document
  public async registerDocument(doc: {
    type: DocumentType;
    referenceId: string;
    customerOrSupplierName?: string;
    totalTtc: number;
  }): Promise<DocumentRecord> {
    const docNumber = await this.getNextNumber(doc.type);
    const record: DocumentRecord = {
      id: `doc-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      document_type: doc.type,
      document_number: docNumber,
      reference_id: doc.referenceId,
      customer_or_supplier_name: doc.customerOrSupplierName,
      total_ttc: doc.totalTtc,
      created_at: new Date().toISOString()
    };

    await db.execute(
      `INSERT INTO commercial_documents (
        id, document_type, document_number, reference_id,
        customer_or_supplier_name, total_ttc, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        record.id, record.document_type, record.document_number, record.reference_id,
        record.customer_or_supplier_name || null, record.total_ttc, record.created_at
      ]
    );

    return record;
  }

  // Liste des documents
  public async getDocuments(type?: DocumentType, limit: number = 100): Promise<DocumentRecord[]> {
    let query = 'SELECT * FROM commercial_documents';
    const params: any[] = [];
    if (type) {
      query += ' WHERE document_type = ?';
      params.push(type);
    }
    query += ` ORDER BY created_at DESC LIMIT ${limit}`;
    return await db.select<DocumentRecord>(query, params);
  }
}

export const documentService = DocumentService.getInstance();
