
'use server';

import { db, isConfigured } from '@/lib/firebase';
import { collection, getDocs, query, orderBy, doc } from 'firebase/firestore';
import type { EditHistoryEntry } from '../types';

const INVOICES_COLLECTION = 'invoices';

export async function getInvoiceEditHistory(invoiceId: string): Promise<EditHistoryEntry[]> {
  if (!isConfigured) {
    return [];
  }

  try {
    const invoiceRef = doc(db, INVOICES_COLLECTION, invoiceId);
    const historyCollectionRef = collection(invoiceRef, 'edit_history');
    
    const historyQuery = query(historyCollectionRef, orderBy('timestamp', 'desc'));
    const snapshot = await getDocs(historyQuery);
    
    return snapshot.docs.map(doc => {
      const data = doc.data();
      return { 
        id: doc.id,
        timestamp: data.timestamp?.toDate ? data.timestamp.toDate().toISOString() : new Date().toISOString(),
        user: data.user,
        changes: data.changes,
      } as EditHistoryEntry;
    });
  } catch (error) {
    console.error(`Error fetching edit history for invoice ${invoiceId}:`, error);
    return [];
  }
}
