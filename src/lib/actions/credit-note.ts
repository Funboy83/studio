
'use server';

import { db, isConfigured } from '@/lib/firebase';
import { doc, getDoc, collection } from 'firebase/firestore';
import type { CreditNoteDetail, Customer } from '@/lib/types';
import { getCustomers } from './customers';

const CREDIT_NOTES_COLLECTION = 'credit_notes';

export async function getCreditNoteById(id: string): Promise<CreditNoteDetail | null> {
  if (!isConfigured) {
    return null;
  }
  try {
    const creditNoteRef = doc(db, `${CREDIT_NOTES_COLLECTION}/${id}`);
    const creditNoteSnap = await getDoc(creditNoteRef);

    if (!creditNoteSnap.exists()) {
      return null;
    }

    const creditNoteData = creditNoteSnap.data();

    // Fetch all customers once
    const customers = await getCustomers();
    const customerMap = new Map(customers.map(c => [c.id, c]));

    const customer = customerMap.get(creditNoteData.customerId);
    if (!customer) {
        throw new Error(`Customer with ID ${creditNoteData.customerId} not found.`);
    }

    return {
      id: creditNoteSnap.id,
      ...creditNoteData,
      customerName: customer.name,
      issueDate: creditNoteData.issueDate,
    } as CreditNoteDetail;

  } catch (error) {
    console.error('Error fetching credit note by ID:', error);
    return null;
  }
}
