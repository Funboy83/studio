
'use server';

import { db, isConfigured } from '@/lib/firebase';
import { collection, getDocs, query, orderBy, addDoc, serverTimestamp, doc, where, getDoc } from 'firebase/firestore';
import type { Customer, Invoice, InvoiceDetail, InvoiceItem } from '../types';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import Link from 'next/link';

const CUSTOMERS_COLLECTION = 'customers';
const INVOICES_COLLECTION = 'invoices';

const CustomerSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters." }),
  phone: z.string().min(10, { message: "Phone number must be at least 10 digits." }),
  email: z.string().email({ message: "Invalid email address." }).optional().or(z.literal('')),
  notes: z.string().optional(),
});

export async function getCustomers(): Promise<Customer[]> {
  if (!isConfigured) {
    return [];
  }

  try {
    const customersCollectionRef = collection(db, CUSTOMERS_COLLECTION);
    const invoicesCollectionRef = collection(db, INVOICES_COLLECTION);
    
    const customersQuery = query(customersCollectionRef, orderBy('name'));
    
    // Fetch both customers and invoices in parallel
    const [customersSnapshot, invoicesSnapshot] = await Promise.all([
      getDocs(customersQuery),
      getDocs(invoicesCollectionRef)
    ]);
    
    const customerInvoiceData: Record<string, { totalInvoices: number, totalSpent: number }> = {};

    // Process invoices to calculate stats
    invoicesSnapshot.docs.forEach(doc => {
      const invoice = doc.data() as Invoice;
      if (invoice.customerId === 'walk-in' || !invoice.customerId) return;

      if (!customerInvoiceData[invoice.customerId]) {
        customerInvoiceData[invoice.customerId] = { totalInvoices: 0, totalSpent: 0 };
      }
      customerInvoiceData[invoice.customerId].totalInvoices += 1;
      customerInvoiceData[invoice.customerId].totalSpent += invoice.total;
    });

    // Map stats to customers
    return customersSnapshot.docs.map(doc => {
      const data = doc.data();
      const createdAt = data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : new Date().toISOString();
      const stats = customerInvoiceData[doc.id] || { totalInvoices: 0, totalSpent: 0 };
      
      return { 
        id: doc.id,
        name: data.name,
        email: data.email,
        phone: data.phone,
        address: data.address,
        notes: data.notes,
        createdAt: createdAt,
        totalInvoices: stats.totalInvoices,
        totalSpent: stats.totalSpent,
        debt: data.debt || 0,
        status: data.status || 'active',
      } as Customer
    });
  } catch (error) {
    console.error('Error fetching customers:', error);
    return [];
  }
}

export async function addCustomer(prevState: any, formData: FormData) {
  const validatedFields = CustomerSchema.safeParse(Object.fromEntries(formData.entries()));

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
    };
  }

  if (!isConfigured) {
    return { errors: { _form: ['Firebase is not configured.'] } };
  }

  try {
    const customersCollectionRef = collection(db, CUSTOMERS_COLLECTION);
    await addDoc(customersCollectionRef, {
      ...validatedFields.data,
      debt: 0,
      status: 'active',
      customerType: 'retail', // Default customer type
      createdAt: serverTimestamp(),
    });
    revalidatePath('/dashboard/customers');
    revalidatePath('/dashboard/invoices/create');
    return { success: true };
  } catch (error) {
    console.error('Error adding customer:', error);
    return { errors: { _form: ['Failed to add customer.'] } };
  }
}

export async function getCustomerDetails(id: string): Promise<{ customer: Customer; invoices: InvoiceDetail[] } | null> {
  if (!isConfigured) {
    return null;
  }
  try {
    const customerRef = doc(db, `${CUSTOMERS_COLLECTION}/${id}`);
    const customerSnap = await getDoc(customerRef);

    if (!customerSnap.exists()) {
      return null;
    }

    const customerData = customerSnap.data();
    const createdAt = customerData.createdAt?.toDate ? customerData.createdAt.toDate().toISOString() : new Date().toISOString();
    
    const customer: Customer = {
      id: customerSnap.id,
      ...customerData,
      createdAt,
      status: customerData.status || 'active',
      totalInvoices: 0, // Will be calculated next
      totalSpent: 0,   // Will be calculated next
      debt: customerData.debt || 0,
    } as Customer;

    const invoicesCollectionRef = collection(db, INVOICES_COLLECTION);
    const invoicesQuery = query(invoicesCollectionRef, where('customerId', '==', id));
    const invoicesSnapshot = await getDocs(invoicesQuery);

    let totalSpent = 0;
    const invoicePromises = invoicesSnapshot.docs.map(async (doc) => {
        const invoiceData = doc.data() as Invoice;
        totalSpent += invoiceData.total;

        const itemsCollectionRef = collection(doc.ref, 'invoice_items');
        const itemsSnapshot = await getDocs(itemsCollectionRef);
        const items = itemsSnapshot.docs.map(itemDoc => ({ id: itemDoc.id, ...itemDoc.data() } as InvoiceItem));

        return {
          id: doc.id,
          ...invoiceData,
          createdAt: invoiceData.createdAt?.toDate ? invoiceData.createdAt.toDate().toISOString() : new Date().toISOString(),
          customer: customer,
          items: items,
        } as InvoiceDetail;
      });

    let invoices = await Promise.all(invoicePromises);
    invoices = invoices.filter(invoice => invoice.status !== 'Voided');

    // Sort in code instead of in the query to avoid needing a composite index
    invoices.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    customer.totalInvoices = invoices.length;
    customer.totalSpent = totalSpent;

    return { customer, invoices };
  } catch (error) {
    console.error('Error fetching customer details:', error);
    return null;
  }
}
