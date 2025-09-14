
'use server';

import { revalidatePath } from 'next/cache';
import { db, isConfigured } from '@/lib/firebase';
import { collection, getDocs, addDoc, serverTimestamp, query, orderBy, doc } from 'firebase/firestore';
import { DATA_PATH } from '../db-path';

const OPTIONS_BASE_PATH = DATA_PATH;

async function getOptions(optionType: string): Promise<string[]> {
    if (!isConfigured) {
        const mockOptions: {[key: string]: string[]} = {
            'options_brand': ['Apple', 'Samsung', 'Google'],
            'options_storage': ['128GB', '256GB', '512GB'],
            'options_color': ['Black', 'White', 'Blue'],
            'options_carrier': ['Unlocked', 'Verizon', 'T-Mobile'],
            'options_grade': ['A', 'B', 'C'],
            'options_condition': ['New', 'Used - Like New', 'Used - Good', 'Used - Fair'],
        }
        return mockOptions[optionType] || [];
    }
    try {
        const dataDocRef = doc(db, OPTIONS_BASE_PATH);
        const optionsCollection = collection(dataDocRef, optionType);
        const q = query(optionsCollection, orderBy('value'));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => doc.data().value as string);
    } catch (error) {
        console.error(`Error fetching options for ${optionType}:`, error);
        return [];
    }
}

async function addOption(optionType: string, value: string): Promise<{ success: boolean; error?: string }> {
    if (!isConfigured) {
        return { success: false, error: 'Firebase is not configured.' };
    }
    if (!value || value.trim().length < 1) {
        return { success: false, error: 'Option value cannot be empty.' };
    }

    try {
        const dataDocRef = doc(db, OPTIONS_BASE_PATH);
        const optionsCollection = collection(dataDocRef, optionType);
        await addDoc(optionsCollection, {
            value: value.trim(),
            createdAt: serverTimestamp(),
        });
        // We can't revalidate from here in the same way, but the client will refetch.
        return { success: true };
    } catch (error) {
        console.error(`Error adding option for ${optionType}:`, error);
        return { success: false, error: `Failed to add new option for ${optionType}.` };
    }
}

export const getBrandOptions = async () => getOptions('options_brand');
export const addBrandOption = async (value: string) => addOption('options_brand', value);

export const getStorageOptions = async () => getOptions('options_storage');
export const addStorageOption = async (value: string) => addOption('options_storage', value);

export const getColorOptions = async () => getOptions('options_color');
export const addColorOption = async (value: string) => addOption('options_color', value);

export const getCarrierOptions = async () => getOptions('options_carrier');
export const addCarrierOption = async (value: string) => addOption('options_carrier', value);

export const getGradeOptions = async () => getOptions('options_grade');
export const addGradeOption = async (value: string) => addOption('options_grade', value);

export const getConditionOptions = async () => getOptions('options_condition');
export const addConditionOption = async (value: string) => addOption('options_condition', value);
