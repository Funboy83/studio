
'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db, isConfigured } from '@/lib/firebase';
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc, writeBatch, serverTimestamp, query, where, getDoc, limit } from 'firebase/firestore';
import type { Product } from '@/lib/types';
import { MOCK_PRODUCTS } from '../mock-data';

const ProductSchema = z.object({
  imei: z.string().min(15, 'IMEI must be at least 15 characters').max(15, 'IMEI must be 15 characters'),
  brand: z.string().min(2, 'Brand must be at least 2 characters'),
  model: z.string().min(2, 'Model must be at least 2 characters'),
  storage: z.string().min(2, 'Storage is required'),
  grade: z.string().min(1, 'Grade is required'),
  color: z.string().min(2, 'Color is required'),
  carrier: z.string().min(3, 'Carrier is required'),
  condition: z.string().min(3, 'Condition is required'),
  price: z.coerce.number().positive('Price must be a positive number'),
  battery: z.coerce.number().int().min(0).max(100, 'Battery must be between 0 and 100'),
  date: z.string().min(1, 'Date is required'),
});

const INVENTORY_COLLECTION = 'inventory';
const INVENTORY_HISTORY_COLLECTION = 'inventory_history';

export async function checkImeiExists(imei: string): Promise<boolean> {
  if (!isConfigured || imei.length !== 15) {
    return false;
  }
  try {
    const inventoryCollectionRef = collection(db, INVENTORY_COLLECTION);
    const q = query(inventoryCollectionRef, where('imei', '==', imei), limit(1));
    const snapshot = await getDocs(q);
    return !snapshot.empty;
  } catch (error) {
    console.error('Error checking IMEI:', error);
    return false; // Fail safe, assume not a duplicate on error
  }
}

export async function getInventory(): Promise<Product[]> {
  if (!isConfigured) {
    console.log('Firebase not configured, returning mock data.');
    return Promise.resolve(MOCK_PRODUCTS);
  }

  try {
    const inventoryCollectionRef = collection(db, INVENTORY_COLLECTION);
    const snapshot = await getDocs(inventoryCollectionRef);
    
    return snapshot.docs.map(doc => {
      const data = doc.data();
      return { 
        id: doc.id, 
        ...data,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
        updatedAt: data.updatedAt?.toDate?.()?.toISOString() || new Date().toISOString(),
      } as Product
    });
  } catch (error) {
    console.error('Error fetching inventory:', error);
    return MOCK_PRODUCTS;
  }
}

export async function addProduct(prevState: any, formData: FormData) {
  const validatedFields = ProductSchema.safeParse(Object.fromEntries(formData.entries()));

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
    };
  }
  
  if (!isConfigured) {
    return { errors: { _form: ['Firebase is not configured.'] } };
  }

  const { imei } = validatedFields.data;
  const imeiExists = await checkImeiExists(imei);
  if (imeiExists) {
    return { errors: { imei: ['This IMEI already exists in the inventory.'] } };
  }


  try {
    const inventoryCollectionRef = collection(db, INVENTORY_COLLECTION);
    const newProduct = {
      ...validatedFields.data,
      status: 'Available',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }
    await addDoc(inventoryCollectionRef, newProduct);
    revalidatePath('/dashboard/inventory');
    return { success: true };
  } catch (error) {
    console.error('Error adding product:', error);
    return { errors: { _form: ['Failed to add product.'] } };
  }
}

export async function updateProduct(id: string, data: Partial<Product>) {
    if (!isConfigured) {
        console.log("Firebase not configured, cannot update.");
        return;
    }
    try {
        const productRef = doc(db, INVENTORY_COLLECTION, id);
        await updateDoc(productRef, { ...data, updatedAt: serverTimestamp() });
        revalidatePath('/dashboard/inventory');
    } catch (error) {
        console.error('Error updating product:', error);
    }
}

export async function deleteProduct(product: Product) {
    if (!isConfigured) {
        console.log("Firebase not configured, cannot delete.");
        return { success: false, error: 'Firebase not configured.' };
    }
    try {
        const productRef = doc(db, INVENTORY_COLLECTION, product.id);
        
        await updateDoc(productRef, {
            status: 'Deleted',
            updatedAt: serverTimestamp()
        });

        revalidatePath('/dashboard/inventory');
        return { success: true };
    } catch (error) {
        console.error('Error deleting product:', error);
        return { success: false, error: 'Failed to delete product.' };
    }
}
