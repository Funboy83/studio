
'use server';

import { revalidatePath } from 'next/cache';
import { db, isConfigured } from '@/lib/firebase';
import { collection, doc, runTransaction, serverTimestamp, getDoc, increment, DocumentReference, writeBatch } from 'firebase/firestore';
import type { Invoice, InvoiceItem, Customer, CreditNote, Product } from '@/lib/types';
import { _createInvoiceWithItems, getLatestInvoiceNumber } from './invoice';
import { _createPaymentWithinTransaction } from './payment';

const INVOICES_COLLECTION = 'invoices';
const CUSTOMERS_COLLECTION = 'customers';
const CREDIT_NOTES_COLLECTION = 'credit_notes';
const PAYMENTS_COLLECTION = 'payments';
const INVENTORY_COLLECTION = 'inventory';

interface ProcessRefundExchangePayload {
    originalInvoice: Invoice;
    returnedItems: InvoiceItem[];
    exchangeItems: InvoiceItem[];
    customer: Customer;
    paymentMade: {
        cash: number;
        card: number;
    };
    refundMethod?: 'Cash' | 'Card';
}

export async function processRefundExchange(payload: ProcessRefundExchangePayload): Promise<{ success: boolean; error?: string }> {
    if (!isConfigured) {
        return { success: false, error: 'Firebase is not configured.' };
    }

    const { originalInvoice, returnedItems, exchangeItems, customer, paymentMade, refundMethod } = payload;
    
    const totalCredit = returnedItems.reduce((acc, item) => acc + item.total, 0);
    const exchangeTotal = exchangeItems.reduce((acc, item) => acc + item.total, 0);
    const finalBalance = exchangeTotal - totalCredit;
    const totalNewPayment = paymentMade.cash + paymentMade.card;

    try {
        const batch = writeBatch(db);

        // === 1. Create the Credit Note ===
        const creditNoteRef = doc(collection(db, CREDIT_NOTES_COLLECTION));
        const creditToApply = exchangeItems.length > 0 ? Math.min(totalCredit, exchangeTotal) : 0;
        const remainingCreditAfterExchange = totalCredit - creditToApply;
        
        const creditNoteData: Omit<CreditNote, 'id'> = {
            originalInvoiceId: originalInvoice.id,
            customerId: customer.id,
            issueDate: new Date().toISOString().split('T')[0],
            items: returnedItems,
            totalCredit: totalCredit,
            remainingCredit: remainingCreditAfterExchange,
            status: remainingCreditAfterExchange > 0 ? 'available' : 'fully_used',
        };
        batch.set(creditNoteRef, creditNoteData);

        const originalInvoiceRef = doc(db, `${INVOICES_COLLECTION}/${originalInvoice.id}`);
        batch.update(originalInvoiceRef, { relatedCreditNoteId: creditNoteRef.id });

        // === 2. Handle Inventory for Returned Items ===
        for (const item of returnedItems) {
            if (!item.isCustom && item.inventoryId) {
                const productRef = doc(db, `${INVENTORY_COLLECTION}/${item.inventoryId}`);
                batch.update(productRef, { status: 'Available' });
            }
        }
        
        let newInvoiceRef: DocumentReference | null = null;
        let finalAmountPaidOnNewInvoice = 0;

        if (exchangeItems.length > 0) {
            // === 3. Create New Invoice for Exchange Items ===
            const newInvoiceNumber = await getLatestInvoiceNumber();
            
            finalAmountPaidOnNewInvoice = creditToApply + totalNewPayment;

            const newInvoiceStatus: Invoice['status'] = finalAmountPaidOnNewInvoice >= exchangeTotal ? 'Paid' : (finalAmountPaidOnNewInvoice > 0 ? 'Partial' : 'Unpaid');

            const newInvoiceData: Omit<Invoice, 'id' | 'createdAt'> = {
                invoiceNumber: String(newInvoiceNumber),
                customerId: customer.id,
                customerName: originalInvoice.customerName,
                subtotal: exchangeTotal, tax: 0, discount: 0, total: exchangeTotal,
                issueDate: new Date().toISOString().split('T')[0],
                dueDate: new Date().toISOString().split('T')[0],
                status: newInvoiceStatus,
                amountPaid: finalAmountPaidOnNewInvoice,
                paymentIds: [], // Will be populated next
                relatedCreditNoteId: creditNoteRef.id,
            };
            
            newInvoiceRef = _createInvoiceWithItems(batch, { invoiceData: newInvoiceData, items: exchangeItems, customer });
            batch.update(creditNoteRef, { newExchangeInvoiceId: newInvoiceRef.id, status: 'fully_used' });

            // === 4. Link Payments to New Invoice ===
            const paymentIds: string[] = [];
            if (creditToApply > 0) {
                const storeCreditPaymentId = _createPaymentWithinTransaction(
                    batch, customer.id, creditToApply, 
                    { storeCreditAmount: creditToApply, cashAmount: 0, checkAmount: 0, cardAmount: 0 },
                    [newInvoiceRef.id]
                );
                paymentIds.push(storeCreditPaymentId);
            }
            if (totalNewPayment > 0) {
                 const newPaymentId = _createPaymentWithinTransaction(
                    batch, customer.id, totalNewPayment, 
                    { cashAmount: paymentMade.cash, cardAmount: paymentMade.card, checkAmount: 0 },
                    [newInvoiceRef.id]
                );
                paymentIds.push(newPaymentId);
            }
            batch.update(newInvoiceRef, { paymentIds });
        }
        
        // === 5. Handle Final Refund if Due ===
        if (remainingCreditAfterExchange > 0 && refundMethod) {
            const refundPaymentId = _createPaymentWithinTransaction(
                batch, customer.id, remainingCreditAfterExchange,
                { 
                    cashAmount: refundMethod === 'Cash' ? remainingCreditAfterExchange : 0, 
                    cardAmount: refundMethod === 'Card' ? remainingCreditAfterExchange : 0,
                    checkAmount: 0
                },
                [], // Refunds aren't applied "to" an invoice
                'refund',
                undefined,
                creditNoteRef.id // Link the refund to the credit note
            );
            // Link refund payment to the credit note for audit trail
            batch.update(creditNoteRef, { refundPaymentId: refundPaymentId, status: 'refunded' });
        }

        // === 6. Update Customer Debt ===
        const debtChange = finalBalance - totalNewPayment;
        const customerRef = doc(db, `${CUSTOMERS_COLLECTION}/${customer.id}`);
        batch.update(customerRef, { debt: increment(debtChange) });

        await batch.commit();

        // Revalidate paths after successful transaction
        revalidatePath('/dashboard/invoices');
        revalidatePath(`/dashboard/invoices/${originalInvoice.id}`);
        revalidatePath('/dashboard/inventory');
        revalidatePath('/dashboard/customers');
        revalidatePath(`/dashboard/customers/${customer.id}`);
        revalidatePath('/dashboard/finance');


        return { success: true };
    } catch (error) {
        console.error('Error processing refund/exchange:', error);
        if (error instanceof Error) {
            return { success: false, error: `Transaction failed: ${error.message}` };
        }
        return { success: false, error: 'An unknown error occurred during the refund process.' };
    }
}
