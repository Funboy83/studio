

'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db, isConfigured } from '@/lib/firebase';
import { collection, getDocs, query, orderBy, limit, addDoc, serverTimestamp, writeBatch, doc, getDoc, collectionGroup, deleteDoc, where, updateDoc, increment, DocumentReference } from 'firebase/firestore';
import { summarizeInvoice } from '@/ai/flows/invoice-summary';
import type { Invoice, InvoiceItem, Product, Customer, InvoiceDetail, InvoiceHistory, EditHistoryEntry, Payment, TenderDetail } from '@/lib/types';
import { getInventory } from './inventory';
import { _createPaymentWithinTransaction } from './payment';

const InvoiceSummarySchema = z.object({
  items: z.array(z.object({
    productName: z.string(),
    description: z.string().optional(),
    quantity: z.number(),
    unitPrice: z.number(),
  }))
});

export async function getInvoiceSummary(items: InvoiceItem[]): Promise<{ summary?: string; error?: string }> {
  try {
    const parsedItems = InvoiceSummarySchema.safeParse({ items });
    if (!parsedItems.success) {
      return { error: 'Invalid item format.' };
    }

    const itemsString = parsedItems.data.items
      .map(item => `${item.quantity} x ${item.productName} (${item.description || 'Custom Item'}) @ $${item.unitPrice.toFixed(2)}`)
      .join('\n');
    
    const result = await summarizeInvoice({ invoiceItems: itemsString });
    return { summary: result.summary };
  } catch (error) {
    console.error('Error getting invoice summary:', error);
    return { error: 'Failed to generate summary.' };
  }
}

const INVOICES_COLLECTION = 'invoices';
const INVENTORY_COLLECTION = 'inventory';
const INVENTORY_HISTORY_COLLECTION = 'inventory_history';
const CUSTOMERS_COLLECTION = 'customers';
const PAYMENTS_COLLECTION = 'payments';
const WALK_IN_CUSTOMER_ID = 'Aj0l1O2kJcvlF3J0uVMX';


export async function getInvoices(): Promise<InvoiceDetail[]> {
  if (!isConfigured) {
    return [];
  }
  try {
    const invoicesCollectionRef = collection(db, INVOICES_COLLECTION);
    const customersCollectionRef = collection(db, CUSTOMERS_COLLECTION);

    const [invoiceSnapshot, customersSnapshot] = await Promise.all([
        getDocs(query(invoicesCollectionRef, where('status', '!=', 'Voided'))),
        getDocs(customersCollectionRef),
    ]);

    const customerMap = new Map<string, Customer>();
    customersSnapshot.docs.forEach(docSnap => {
      const data = docSnap.data();
      customerMap.set(docSnap.id, {
        id: docSnap.id,
        name: data.name,
        email: data.email,
        phone: data.phone,
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : new Date().toISOString(),
        totalInvoices: 0,
        totalSpent: 0,
        debt: data.debt || 0,
      } as Customer);
    });

    const invoiceDetails: InvoiceDetail[] = [];

    for (const invoiceDoc of invoiceSnapshot.docs) {
      const invoiceData = invoiceDoc.data() as Invoice;

      const createdAt = invoiceData.createdAt?.toDate ? invoiceData.createdAt.toDate().toISOString() : new Date().toISOString();
      
      const itemsCollectionRef = collection(invoiceDoc.ref, 'invoice_items');
      const itemsSnapshot = await getDocs(itemsCollectionRef);
      const items = itemsSnapshot.docs.map(itemDoc => ({ id: itemDoc.id, ...itemDoc.data() } as InvoiceItem));

      const historyCollectionRef = collection(invoiceDoc.ref, 'edit_history');
      const historySnapshot = await getDocs(historyCollectionRef);
      const isEdited = historySnapshot.size > 1;

      let customer: Customer | undefined;
      if (invoiceData.customerId === WALK_IN_CUSTOMER_ID) {
        customer = customerMap.get(WALK_IN_CUSTOMER_ID);
        if (customer) {
            customer = { ...customer, name: invoiceData.customerName || 'Walk-In Customer' };
        }
      } else {
        customer = customerMap.get(invoiceData.customerId);
      }
      
      if (customer) {
        const invoiceBase = { id: invoiceDoc.id, ...invoiceData, createdAt } as Invoice;
        invoiceDetails.push({
          ...invoiceBase,
          customer,
          items,
          isEdited
        });
      }
    }
    
    const statusOrder = ['Unpaid', 'Partial', 'Paid', 'Draft', 'Overdue'];
    invoiceDetails.sort((a, b) => {
        const statusA = a.status || 'Paid';
        const statusB = b.status || 'Paid';
        const indexA = statusOrder.indexOf(statusA);
        const indexB = statusOrder.indexOf(statusB);
        if (indexA !== indexB) {
            return indexA - indexB;
        }
        return new Date(b.createdAt).getTime() - new Date(b.createdAt).getTime();
    });

    return invoiceDetails;
  } catch (error) {
      console.error('Error fetching invoices:', error);
      return [];
  }
}

export async function getInvoiceById(id: string): Promise<InvoiceDetail | null> {
    if (!isConfigured) {
        return null;
    }
    try {
        const invoiceRef = doc(db, `${INVOICES_COLLECTION}/${id}`);
        const invoiceSnap = await getDoc(invoiceRef);

        if (!invoiceSnap.exists()) {
            return null;
        }

        const invoiceData = invoiceSnap.data() as Invoice;
        const createdAt = invoiceData.createdAt?.toDate ? invoiceData.createdAt.toDate().toISOString() : new Date().toISOString();

        const itemsCollectionRef = collection(invoiceSnap.ref, 'invoice_items');
        const itemsSnapshot = await getDocs(itemsCollectionRef);
        const items = itemsSnapshot.docs.map(itemDoc => ({ id: itemDoc.id, ...itemDoc.data() } as InvoiceItem));

        const customerRef = doc(db, `${CUSTOMERS_COLLECTION}/${invoiceData.customerId}`);
        const customerSnap = await getDoc(customerRef);
        
        if (!customerSnap.exists()) {
            throw new Error(`Customer with ID ${invoiceData.customerId} not found for invoice ${id}`);
        }
        const customerData = customerSnap.data();
        const customer = { 
            id: customerSnap.id,
            ...customerData,
            createdAt: customerData.createdAt?.toDate ? customerData.createdAt.toDate().toISOString() : new Date().toISOString(),
         } as Customer;

        if (invoiceData.customerId === WALK_IN_CUSTOMER_ID) {
            customer.name = invoiceData.customerName || 'Walk-In Customer';
        }

        // Fetch related payments
        let payments: Payment[] = [];
        if (invoiceData.paymentIds && invoiceData.paymentIds.length > 0) {
            const paymentPromises = invoiceData.paymentIds.map(pid => 
                getDoc(doc(db, `${PAYMENTS_COLLECTION}/${pid}`))
            );
            const paymentDocs = await Promise.all(paymentPromises);
            payments = paymentDocs
                .filter(doc => doc.exists())
                .map(docSnap => {
                    const data = docSnap.data();
                    const paymentDate = data.paymentDate?.toDate ? data.paymentDate.toDate().toISOString() : new Date().toISOString();
                    return { id: docSnap.id, ...data, paymentDate } as Payment;
                });
        }


        return {
            id: invoiceSnap.id,
            ...invoiceData,
            createdAt,
            customer,
            items,
            payments,
        } as InvoiceDetail;

    } catch (error) {
        console.error('Error fetching invoice by ID:', error);
        return null;
    }
}

export async function getLatestInvoiceNumber(): Promise<number> {
  if (!isConfigured) {
    return 1000;
  }
  try {
    const invoicesCollectionRef = collection(db, INVOICES_COLLECTION);
    const snapshot = await getDocs(invoicesCollectionRef);

    if (snapshot.empty) {
      return 1000;
    }

    let maxNumber = 999;
    snapshot.docs.forEach(doc => {
      const invoiceNumberStr = doc.data().invoiceNumber;
      if (invoiceNumberStr) {
        const currentNumber = parseInt(invoiceNumberStr, 10);
        if (!isNaN(currentNumber) && currentNumber > maxNumber) {
          maxNumber = currentNumber;
        }
      }
    });

    return maxNumber + 1;
  } catch (error) {
    console.error('Error fetching latest invoice number:', error);
    return 1000; // Fallback in case of error
  }
}

interface CreateInvoicePayload {
  invoiceData: Omit<Invoice, 'id' | 'createdAt'>;
  items: InvoiceItem[];
  customer: Customer;
}

/**
 * Internal helper to create an invoice and its items within a Firestore transaction/batch.
 * This is the "Master Chef" function. It does NOT commit the batch.
 * @returns The DocumentReference of the new invoice.
 */
export async function _createInvoiceWithItems(
  batch: WriteBatch,
  payload: CreateInvoicePayload
): Promise<DocumentReference> {
  const { invoiceData, items, customer } = payload;
  
  const invoiceRef = doc(collection(db, INVOICES_COLLECTION));

  const finalInvoiceData = { ...invoiceData, createdAt: serverTimestamp() };
  batch.set(invoiceRef, finalInvoiceData);

  // Handle inventory updates and history for sold items
  for (const item of items) {
    const itemRef = doc(collection(invoiceRef, 'invoice_items'));
    batch.set(itemRef, { ...item, inventoryId: item.isCustom ? null : item.id });

    if (!item.isCustom && item.id) {
      const inventoryItemRef = doc(db, `${INVENTORY_COLLECTION}/${item.id}`);
      // Note: We expect the calling function to have verified inventory existence.
      // In a real-world scenario, you might re-fetch here if not using a transaction.
      const productHistoryRef = doc(collection(db, INVENTORY_HISTORY_COLLECTION));
      batch.set(productHistoryRef, {
        // This assumes 'item' has enough product details, which might need adjustment.
        // For now, we'll store what we have. A better approach might fetch the full product.
        ...item, // This is a simplification.
        id: item.id,
        imei: item.description?.split(' - ')[0] || 'N/A', // Assuming description has IMEI
        status: 'Sold' as const,
        amount: item.total,
        movedAt: serverTimestamp(),
        customerId: customer.id,
        customerName: invoiceData.customerName || customer.name,
        invoiceId: invoiceRef.id,
      });
      batch.delete(inventoryItemRef);
    }
  }

  // Create initial edit history
  const historyRef = doc(collection(invoiceRef, 'edit_history'));
  batch.set(historyRef, {
    timestamp: serverTimestamp(),
    user: 'admin_user', // Hardcoded user
    changes: { initialCreation: { from: null, to: `Invoice Created (Total: ${invoiceData.total.toFixed(2)})` } }
  });

  return invoiceRef;
}


interface SendInvoiceData {
  invoiceData: Omit<Invoice, 'id' | 'createdAt'>;
  items: InvoiceItem[];
  customer?: Customer;
  cashAmount: number;
  cardAmount: number;
}

export async function sendInvoice({ invoiceData, items, customer, cashAmount, cardAmount }: SendInvoiceData) {
    if (!isConfigured) {
        return { success: false, error: 'Firebase is not configured.' };
    }
    if (!customer) {
      return { success: false, error: 'Customer is required.' };
    }

    const totalPaid = cashAmount + cardAmount;

    try {
        const batch = writeBatch(db);

        const amountDue = invoiceData.total - totalPaid;
        let status: Invoice['status'] = 'Draft';
        if (totalPaid <= 0 && invoiceData.total > 0) status = 'Unpaid';
        else if (amountDue > 0) status = 'Partial';
        else status = 'Paid';

        const finalInvoiceData: any = {
            ...invoiceData,
            status,
            amountPaid: totalPaid,
            paymentIds: [],
        };

        const invoiceRef = await _createInvoiceWithItems(batch, { invoiceData: finalInvoiceData, items, customer });

        if (totalPaid > 0) {
            const paymentId = _createPaymentWithinTransaction(
              batch, 
              customer.id, 
              totalPaid, 
              { cashAmount, cardAmount, checkAmount: 0 },
              [invoiceRef.id]
            );
            // Update the invoice with the actual payment ID
            batch.update(invoiceRef, { paymentIds: [paymentId] });
        }
        
        if (customer.id !== WALK_IN_CUSTOMER_ID && amountDue > 0) {
            const customerRef = doc(db, `${CUSTOMERS_COLLECTION}/${customer.id}`);
            batch.update(customerRef, { debt: increment(amountDue) });
        }
        
        await batch.commit();

        revalidatePath('/dashboard/invoices');
        revalidatePath('/dashboard/inventory');
        revalidatePath('/dashboard/inventory/history');
        revalidatePath(`/dashboard/customers/${customer.id}`);
        revalidatePath('/dashboard/customers');
        revalidatePath('/dashboard/finance');

        return { success: true, invoiceId: invoiceRef.id };

    } catch (error) {
        console.error('Error sending invoice and updating inventory:', error);
        if (error instanceof Error) {
            return { success: false, error: `Failed to send invoice: ${error.message}` };
        }
        return { success: false, error: 'An unknown error occurred while sending the invoice.' };
    }
}

interface UpdateInvoicePayload {
  originalInvoice: InvoiceDetail;
  updatedInvoice: Omit<Invoice, 'id' | 'createdAt' | 'status'>;
  updatedItems: InvoiceItem[];
}

export async function updateInvoice({ originalInvoice, updatedInvoice, updatedItems }: UpdateInvoicePayload): Promise<{ success: boolean; error?: string }> {
  if (!isConfigured) {
    return { success: false, error: 'Firebase is not configured.' };
  }

  try {
    const invoiceRef = doc(db, `${INVOICES_COLLECTION}/${originalInvoice.id}`);
    
    // Server-side validation: Fetch the latest invoice state
    const currentInvoiceSnap = await getDoc(invoiceRef);
    if (!currentInvoiceSnap.exists()) {
        return { success: false, error: 'Invoice not found.' };
    }
    const currentInvoice = currentInvoiceSnap.data() as Invoice;

    if (currentInvoice.status !== 'Unpaid') {
      return { success: false, error: `Cannot edit an invoice with status "${currentInvoice.status}".` };
    }

    const batch = writeBatch(db);

    // --- 1. Detect Changes and Create History Entry ---
    const changes: EditHistoryEntry['changes'] = {};

    // Compare simple fields
    if (originalInvoice.customer.id !== updatedInvoice.customerId) {
      changes.customer = { from: originalInvoice.customer.name, to: updatedInvoice.customerName };
    }
    if (originalInvoice.dueDate !== updatedInvoice.dueDate) {
      changes.dueDate = { from: originalInvoice.dueDate, to: updatedInvoice.dueDate };
    }
    if (originalInvoice.summary !== updatedInvoice.summary) {
      changes.summary = { from: originalInvoice.summary || 'N/A', to: updatedInvoice.summary || 'N/A' };
    }
    if (originalInvoice.total !== updatedInvoice.total) {
      changes.totalAmount = { from: originalInvoice.total.toFixed(2), to: updatedInvoice.total.toFixed(2) };
    }
    
    // Compare items
    const originalItemsMap = new Map(originalInvoice.items.map(item => [item.id, item]));
    const updatedItemsMap = new Map(updatedItems.map(item => [item.id, item]));

    // Check for removed and modified items
    for (const [id, originalItem] of originalItemsMap.entries()) {
      const updatedItem = updatedItemsMap.get(id);
      if (!updatedItem) {
        changes[`removedItem_${id.slice(0,5)}`] = { from: originalItem.productName, to: 'Removed' };
      } else {
        if (originalItem.quantity !== updatedItem.quantity) {
          changes[`itemQty_${id.slice(0,5)}`] = { from: `${originalItem.productName} (Qty: ${originalItem.quantity})`, to: `Qty: ${updatedItem.quantity}` };
        }
        if (originalItem.unitPrice !== updatedItem.unitPrice) {
          changes[`itemPrice_${id.slice(0,5)}`] = { from: `${originalItem.productName} (Price: ${originalItem.unitPrice.toFixed(2)})`, to: `Price: ${updatedItem.unitPrice.toFixed(2)}` };
        }
      }
    }

    // Check for added items
    for (const [id, updatedItem] of updatedItemsMap.entries()) {
      if (!originalItemsMap.has(id)) {
        changes[`addedItem_${id.slice(0,5)}`] = { from: 'Not present', to: updatedItem.productName };
      }
    }

    if (Object.keys(changes).length > 0) {
      const historyRef = doc(collection(invoiceRef, 'edit_history'));
      const historyEntry: Omit<EditHistoryEntry, 'id'> = {
        timestamp: serverTimestamp(),
        user: 'admin_user', // Hardcoded for now
        changes: changes,
      };
      batch.set(historyRef, historyEntry);
    }
    
    // --- 2. Update Invoice Document ---
    batch.update(invoiceRef, updatedInvoice as any);

    // --- 3. Update/Re-create Items Subcollection ---
    const oldItemsSnapshot = await getDocs(collection(invoiceRef, 'invoice_items'));
    oldItemsSnapshot.docs.forEach(doc => batch.delete(doc.ref));

    for (const item of updatedItems) {
      const newItemRef = doc(collection(invoiceRef, 'invoice_items'));
      batch.set(newItemRef, item);
    }
    
    // --- 4. Handle inventory and debt changes ---
    // This part is complex. For now, we only handle debt adjustment based on total change.
    // A full implementation would need to track item-level changes to restock/un-stock inventory.
    const totalDifference = updatedInvoice.total - originalInvoice.total;
    if (totalDifference !== 0 && originalInvoice.customer.id !== WALK_IN_CUSTOMER_ID) {
      const customerRef = doc(db, `${CUSTOMERS_COLLECTION}/${originalInvoice.customer.id}`);
      batch.update(customerRef, { debt: increment(totalDifference) });
    }

    await batch.commit();

    revalidatePath(`/dashboard/invoices`);
    revalidatePath(`/dashboard/invoices/${originalInvoice.id}/edit`);
    revalidatePath(`/dashboard/invoices/${originalInvoice.id}`);
    revalidatePath(`/dashboard/invoices/${originalInvoice.id}/history`);
    revalidatePath(`/dashboard/customers`);
    revalidatePath(`/dashboard/customers/${originalInvoice.customer.id}`);


    return { success: true };
  } catch (error) {
    console.error('Error updating invoice:', error);
    if (error instanceof Error) {
      return { success: false, error: `Failed to update invoice: ${error.message}` };
    }
    return { success: false, error: 'An unknown error occurred while updating the invoice.' };
  }
}


export async function archiveInvoice(invoice: InvoiceDetail): Promise<{ success: boolean, error?: string }> {
  if (!isConfigured) {
    return { success: false, error: 'Firebase is not configured.' };
  }

  try {
    const originalInvoiceRef = doc(db, `${INVOICES_COLLECTION}/${invoice.id}`);

    // Server-side validation
    const currentInvoiceSnap = await getDoc(originalInvoiceRef);
    if (!currentInvoiceSnap.exists()) {
        return { success: false, error: 'Invoice not found.' };
    }
    const currentInvoice = currentInvoiceSnap.data() as Invoice;

    if (currentInvoice.status !== 'Unpaid') {
      return { success: false, error: `Cannot void an invoice with status "${currentInvoice.status}".` };
    }

    const batch = writeBatch(db);
    
    batch.update(originalInvoiceRef, { status: 'Voided' });

    // Since we now only allow voiding 'Unpaid' invoices, the debt reversal logic simplifies.
    // We just reverse the full total of the invoice.
    if (invoice.customer.id !== WALK_IN_CUSTOMER_ID) {
        const customerRef = doc(db, `${CUSTOMERS_COLLECTION}/${invoice.customer.id}`);
        batch.update(customerRef, { debt: increment(-invoice.total) });
    }
    
    const inventoryHistoryRef = collection(db, INVENTORY_HISTORY_COLLECTION);
    const q = query(inventoryHistoryRef, where('invoiceId', '==', invoice.id));
    const historyItemsSnap = await getDocs(q);

    for (const docSnap of historyItemsSnap.docs) {
      const historyItem = docSnap.data() as InvoiceHistory;
      
      const { status, amount, movedAt, customerId, customerName, invoiceId, ...originalProduct } = historyItem;

      if (originalProduct.id && originalProduct.brand && originalProduct.model) {
        const inventoryRef = doc(db, `${INVENTORY_COLLECTION}/${originalProduct.id}`);
        batch.set(inventoryRef, { ...originalProduct, status: 'Available' }); 
      }
      
      batch.update(docSnap.ref, { status: 'Voided' });
    }

    await batch.commit();

    revalidatePath('/dashboard/invoices');
    revalidatePath('/dashboard/inventory');
    revalidatePath('/dashboard/inventory/history');
    revalidatePath(`/dashboard/customers/${invoice.customer.id}`);
    revalidatePath('/dashboard/customers');


    return { success: true };
  } catch (error) {
    console.error('Error archiving invoice:', error);
    if (error instanceof Error) {
      return { success: false, error: `Failed to archive invoice: ${error.message}` };
    }
    return { success: false, error: 'An unknown error occurred while archiving the invoice.' };
  }
}
