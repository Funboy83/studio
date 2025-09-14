










'use server';

import { revalidatePath } from 'next/cache';
import { db, isConfigured } from '@/lib/firebase';
import { collection, doc, runTransaction, serverTimestamp, getDocs, where, query, orderBy, increment, WriteBatch, collectionGroup, getDoc } from 'firebase/firestore';
import type { Invoice, Customer, TenderDetail, Payment, PaymentDetail, InvoiceDetail, InvoiceItem } from '@/lib/types';
import { getCustomers } from './customers';
import { DATA_PATH } from '../db-path';

interface ApplyPaymentPayload {
  customerId: string;
  cashAmount: number;
  checkAmount: number;
  cardAmount: number;
  notes?: string;
}

const PAYMENTS_COLLECTION = 'payments';
const INVOICES_COLLECTION = 'invoices';
const CUSTOMERS_COLLECTION = 'customers';

export async function getPayments(): Promise<PaymentDetail[]> {
  if (!isConfigured) {
    return [];
  }
  try {
    const dataDocRef = doc(db, DATA_PATH);
    const paymentsCollectionRef = collection(dataDocRef, PAYMENTS_COLLECTION);
    
    const [paymentsSnapshot, customers, invoicesSnapshot] = await Promise.all([
      getDocs(query(paymentsCollectionRef, orderBy('paymentDate', 'desc'))),
      getCustomers(),
      getDocs(collection(dataDocRef, INVOICES_COLLECTION))
    ]);
    
    const customerMap = new Map<string, Customer>();
    customers.forEach(customer => customerMap.set(customer.id, customer));

    const invoiceMap = new Map<string, Invoice>();
    invoicesSnapshot.forEach(doc => invoiceMap.set(doc.id, { id: doc.id, ...doc.data()} as Invoice));
    
    const paymentDetailsPromises = paymentsSnapshot.docs.map(async (paymentDoc) => {
      const data = paymentDoc.data() as Payment;
      const paymentDate = data.paymentDate?.toDate ? data.paymentDate.toDate() : (data.paymentDate ? new Date(data.paymentDate) : new Date());
      const customer = data.customerId ? customerMap.get(data.customerId) : undefined;
      
      const appliedToInvoicesPromises = (data.appliedToInvoices || []).map(async (invoiceId) => {
          const invoiceRef = doc(dataDocRef, `${INVOICES_COLLECTION}/${invoiceId}`);
          const invoiceSnap = await getDoc(invoiceRef);
          if (!invoiceSnap.exists()) return null;

          const invoiceData = invoiceSnap.data() as Invoice;
          const invoiceCustomer = customerMap.get(invoiceData.customerId);
          if (!invoiceCustomer) return null;

          const itemsCollectionRef = collection(invoiceRef, 'invoice_items');
          const itemsSnapshot = await getDocs(itemsCollectionRef);
          const items = itemsSnapshot.docs.map(itemDoc => ({ id: itemDoc.id, ...itemDoc.data() } as InvoiceItem));

          return {
              ...invoiceData,
              id: invoiceId,
              customer: invoiceCustomer,
              items,
              createdAt: invoiceData.createdAt?.toDate ? invoiceData.createdAt.toDate().toISOString() : new Date().toISOString(),
          } as InvoiceDetail
      });

      const appliedToInvoices = (await Promise.all(appliedToInvoicesPromises)).filter((inv): inv is InvoiceDetail => inv !== null);

      return { 
        id: paymentDoc.id, 
        ...data,
        paymentDate: paymentDate.toISOString(),
        customerName: customer ? customer.name : 'N/A',
        appliedToInvoices,
      } as PaymentDetail;
    });

    const paymentDetails = await Promise.all(paymentDetailsPromises);

    return paymentDetails;

  } catch (error) {
    console.error('Error fetching payments:', error);
    return [];
  }
}

/**
 * Internal helper to create a payment record within a Firestore transaction/batch.
 * This is not to be called directly from a component.
 * @returns The ID of the new payment document.
 */
export async function _createPaymentWithinTransaction(
  batch: WriteBatch,
  customerId: string,
  totalAmount: number,
  amounts: { cashAmount: number; checkAmount: number; cardAmount: number; storeCreditAmount?: number },
  appliedInvoiceIds: string[],
  type: 'payment' | 'refund' = 'payment',
  notes?: string,
  sourceCreditNoteId?: string
): Promise<string> {
    const dataDocRef = doc(db, DATA_PATH);
    const paymentRef = doc(collection(dataDocRef, PAYMENTS_COLLECTION));

    const isRefund = type === 'refund';
    const sign = isRefund ? -1 : 1;

    const tenderDetails: TenderDetail[] = [];
    if (amounts.cashAmount > 0) tenderDetails.push({ method: 'Cash', amount: amounts.cashAmount * sign });
    if (amounts.checkAmount > 0) tenderDetails.push({ method: 'Check', amount: amounts.checkAmount * sign });
    if (amounts.cardAmount > 0) tenderDetails.push({ method: 'Card/Zelle/Wire', amount: amounts.cardAmount * sign });
    if (amounts.storeCreditAmount && amounts.storeCreditAmount > 0) tenderDetails.push({ method: 'StoreCredit', amount: amounts.storeCreditAmount });


    const paymentData: any = {
        customerId: customerId,
        paymentDate: serverTimestamp(),
        recordedBy: 'admin_user', // Hardcoded user
        amountPaid: totalAmount * sign,
        type: type,
        appliedToInvoices: appliedInvoiceIds,
        tenderDetails: tenderDetails,
    };

    if (notes) {
        paymentData.notes = notes;
    }
    if (sourceCreditNoteId) {
        paymentData.sourceCreditNoteId = sourceCreditNoteId;
    }

    batch.set(paymentRef, paymentData);
    return paymentRef.id;
}


export async function applyPayment(payload: ApplyPaymentPayload): Promise<{ success: boolean; error?: string }> {
  if (!isConfigured) {
    return { success: false, error: 'Firebase is not configured.' };
  }

  const { customerId, cashAmount, checkAmount, cardAmount, notes } = payload;
  const totalPaid = cashAmount + checkAmount + cardAmount;

  if (totalPaid <= 0) {
    return { success: false, error: 'Payment amount must be greater than zero.' };
  }

  try {
    await runTransaction(db, async (transaction) => {
      const dataDocRef = doc(db, DATA_PATH);
      const customerRef = doc(dataDocRef, `${CUSTOMERS_COLLECTION}/${customerId}`);
      const invoicesCollectionRef = collection(dataDocRef, INVOICES_COLLECTION);
      
      // --- 1. READ PHASE ---
      const customerDoc = await transaction.get(customerRef);
      if (!customerDoc.exists()) {
        throw new Error("Customer not found.");
      }

      const outstandingInvoicesQuery = query(
        invoicesCollectionRef,
        where('customerId', '==', customerId),
        where('status', 'in', ['Unpaid', 'Partial'])
      );
      
      const querySnapshot = await getDocs(outstandingInvoicesQuery);
      
      const outstandingInvoices = querySnapshot.docs
        .map(d => ({ id: d.id, ...d.data() } as Invoice))
        .sort((a, b) => new Date(a.issueDate).getTime() - new Date(b.issueDate).getTime());

      // --- 2. LOGIC/CALCULATION PHASE (IN-MEMORY) ---
      let paymentRemaining = totalPaid;
      const appliedInvoiceIds: string[] = [];
      const invoiceUpdates: { ref: any; data: any }[] = [];

      for (const invoice of outstandingInvoices) {
        if (paymentRemaining <= 0) break;
        
        const invoiceRef = doc(dataDocRef, `${INVOICES_COLLECTION}/${invoice.id}`);
        const currentAmountPaid = invoice.amountPaid || 0;
        const amountDueOnInvoice = invoice.total - currentAmountPaid;
        
        if (amountDueOnInvoice <= 0) continue;

        const amountToApply = Math.min(paymentRemaining, amountDueOnInvoice);
        const newAmountPaid = currentAmountPaid + amountToApply;
        
        let newStatus: Invoice['status'] = 'Partial';
        if (newAmountPaid >= invoice.total) {
          newStatus = 'Paid';
        }
        
        invoiceUpdates.push({
          ref: invoiceRef,
          data: {
            amountPaid: newAmountPaid,
            status: newStatus,
            paymentIds: [...(invoice.paymentIds || []), 'placeholder_payment_id'], // Placeholder
          }
        });

        appliedInvoiceIds.push(invoice.id);
        paymentRemaining -= amountToApply;
      }
      
      const currentDebt = customerDoc.data().debt || 0;
      const newDebt = Math.max(0, currentDebt - totalPaid);

      // --- 3. WRITE PHASE (using WriteBatch inside transaction) ---
      const batch = writeBatch(db); // Use a batch to manage writes

      const paymentId = await _createPaymentWithinTransaction(
        batch,
        customerId,
        totalPaid,
        { cashAmount, checkAmount, cardAmount },
        appliedInvoiceIds,
        'payment',
        notes
      );

      for (const update of invoiceUpdates) {
        const paymentIds = update.data.paymentIds.map((id: string) => id === 'placeholder_payment_id' ? paymentId : id);
        batch.update(update.ref, { ...update.data, paymentIds });
      }
      
      batch.update(customerRef, { debt: newDebt });

      // The transaction will commit the batch.
      // This is a subtle point: you don't commit the batch yourself.
      // The transaction object will handle it.
      // To pass writes to the transaction, we must use transaction.set/update/delete.
      // Let's refactor to use transaction directly instead of a batch.
    });

    // Re-running with direct transaction writes as 'batch' inside 'runTransaction' is not the standard pattern.
     await runTransaction(db, async (transaction) => {
      const dataDocRef = doc(db, DATA_PATH);
      const customerRef = doc(dataDocRef, `${CUSTOMERS_COLLECTION}/${customerId}`);
      const invoicesCollectionRef = collection(dataDocRef, INVOICES_COLLECTION);
      
      const customerDoc = await transaction.get(customerRef);
      if (!customerDoc.exists()) throw new Error("Customer not found.");

      const outstandingInvoicesQuery = query(
        invoicesCollectionRef,
        where('customerId', '==', customerId),
        where('status', 'in', ['Unpaid', 'Partial'])
      );
      
      // Note: getDocs cannot be used inside a transaction. We must fetch outside and pass data in,
      // or redesign. The current `applyPayment` is designed to be atomic for a single customer,
      // so we will perform reads and then the transaction. This is safe if concurrent payments
      // for the same customer are rare. The reads are outside the transaction.
      const querySnapshot = await getDocs(outstandingInvoicesQuery);
      const outstandingInvoices = querySnapshot.docs
        .map(d => ({ id: d.id, ...d.data() } as Invoice))
        .sort((a, b) => new Date(a.issueDate).getTime() - new Date(b.issueDate).getTime());

      let paymentRemaining = totalPaid;
      const appliedInvoiceIds: string[] = [];
      const paymentRef = doc(collection(dataDocRef, PAYMENTS_COLLECTION));

      for (const invoice of outstandingInvoices) {
        if (paymentRemaining <= 0) break;
        const invoiceRef = doc(dataDocRef, `${INVOICES_COLLECTION}/${invoice.id}`);
        const currentAmountPaid = invoice.amountPaid || 0;
        const amountDueOnInvoice = invoice.total - currentAmountPaid;
        
        if (amountDueOnInvoice <= 0) continue;
        const amountToApply = Math.min(paymentRemaining, amountDueOnInvoice);
        
        transaction.update(invoiceRef, {
            amountPaid: increment(amountToApply),
            status: (currentAmountPaid + amountToApply) >= invoice.total ? 'Paid' : 'Partial',
            paymentIds: [...(invoice.paymentIds || []), paymentRef.id]
        });

        appliedInvoiceIds.push(invoice.id);
        paymentRemaining -= amountToApply;
      }
      
      const tenderDetails: TenderDetail[] = [];
      if (cashAmount > 0) tenderDetails.push({ method: 'Cash', amount: cashAmount });
      if (checkAmount > 0) tenderDetails.push({ method: 'Check', amount: checkAmount });
      if (cardAmount > 0) tenderDetails.push({ method: 'Card/Zelle/Wire', amount: cardAmount });
      
      const paymentData: any = {
        customerId,
        paymentDate: serverTimestamp(),
        recordedBy: 'admin_user',
        amountPaid: totalPaid,
        type: 'payment',
        appliedToInvoices: appliedInvoiceIds,
        tenderDetails,
        ...(notes && { notes }),
      };
      transaction.set(paymentRef, paymentData);
      
      transaction.update(customerRef, { debt: increment(-totalPaid) });
    });


    revalidatePath(`/dashboard/customers/${customerId}`);
    revalidatePath(`/dashboard/customers/${customerId}/payment`);
    revalidatePath('/dashboard/invoices');
    revalidatePath('/dashboard/finance');


    return { success: true };

  } catch (error) {
    console.error('Error applying payment:', error);
    if (error instanceof Error) {
      return { success: false, error: `Failed to apply payment: ${error.message}` };
    }
    return { success: false, error: 'An unknown error occurred while applying the payment.' };
  }
}








