
'use server';

import { db, isConfigured } from '@/lib/firebase';
import { collection, getDocs, query, orderBy, doc } from 'firestore';
import type { ProductHistory, Customer } from '../types';
import { getCustomers } from './customers';
import { DATA_PATH } from '@/lib/db-path';

const INVENTORY_HISTORY_COLLECTION = `${DATA_PATH}/inventory_history`;

export async function getInventoryHistory(): Promise<ProductHistory[]> {
  if (!isConfigured) {
    console.log('Firebase not configured, returning empty history.');
    return [];
  }

  try {
    const historyCollectionRef = collection(db, INVENTORY_HISTORY_COLLECTION);
    
    const [historySnapshot, customers] = await Promise.all([
      getDocs(query(historyCollectionRef, orderBy('movedAt', 'desc'))),
      getCustomers()
    ]);
    
    const customerMap = new Map<string, Customer>();
    customers.forEach(customer => customerMap.set(customer.id, customer));
    
    return historySnapshot.docs.map(doc => {
      const data = doc.data();
      const movedAt = data.movedAt?.toDate ? data.movedAt.toDate() : (data.movedAt ? new Date(data.movedAt) : new Date());
      const customer = data.customerId ? customerMap.get(data.customerId) : undefined;
      
      return { 
        id: doc.id, 
        ...data,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
        updatedAt: data.updatedAt?.toDate?.()?.toISOString() || null,
        movedAt: movedAt.toISOString(),
        customerName: customer ? customer.name : 'N/A',
      } as ProductHistory
    });
  } catch (error) {
    console.error('Error fetching inventory history:', error);
    return [];
  }
}
