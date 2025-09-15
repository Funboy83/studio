
'use server';

import { db, isConfigured } from '@/lib/firebase';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';
import type { CreditNoteDetail, Customer } from '@/lib/types';
import { getCustomers } from './customers';
import { DATA_PATH } from '@/lib/db-path';

const CREDIT_NOTES_COLLECTION = `${DATA_PATH}/credit_notes`;
const CUSTOMERS_COLLECTION = `${DATA_PATH}/customers`;

export async function getCreditNoteById(id: string): Promise<CreditNoteDetail | null> {
  if (!isConfigured) {
    return null;
  }
  try {
    const creditNoteRef = doc(db, CREDIT_NOTES_COLLECTION, id);
    const creditNoteSnap = await getDoc(creditNoteRef);

    if (!creditNoteSnap.exists()) {
      return null;
    }

    const creditNoteData = creditNoteSnap.data();

    // Fetch all customers once
    const customerRef = doc(db, CUSTOMERS_COLLECTION, creditNoteData.customerId);
    const customerSnap = await getDoc(customerRef);
    
    if (!customerSnap.exists()) {
         throw new Error(`Customer with ID ${creditNoteData.customerId} not found.`);
    }
    const customer = customerSnap.data() as Customer;


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
