
// This is a one-time migration script to be run with Node.js.
// It migrates data from a flat structure to the nested structure required by the application.
// Specifically, it handles:
// 1. Restructuring customer documents.
// 2. Restructuring invoice documents.
// 3. Moving invoice items from an array on the invoice to a dedicated 'invoice_items' subcollection.
//
// === IMPORTANT: THIS SCRIPT CREATES A NEW DATA STRUCTURE ===
// This script reads from your root collections and writes to the 'wholease/data/' path.
// It is designed to be run once. Back up your data if you are unsure.
// ==========================================================

// ====== SETUP ======
// 1. If you haven't already, install Firebase Admin SDK:
//    npm install firebase-admin
//
// 2. Make sure your Service Account Key file is in the project root:
//    - It should be named "serviceAccountKey.json".
//
// 3. Run the script from your project's root directory:
//    node migration-script.js
// ===================

const admin = require('firebase-admin');

// --- Step 1: Configuration ---
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// --- Configuration for source and destination paths ---
const SOURCE_CUSTOMERS_PATH = 'customers';
const SOURCE_INVOICES_PATH = 'invoices';

const DEST_ROOT_PATH = 'wholease/data';
const DEST_CUSTOMERS_PATH = `${DEST_ROOT_PATH}/customers`;
const DEST_INVOICES_PATH = `${DEST_ROOT_PATH}/invoices`;

console.log('Starting comprehensive Firestore data migration...');
console.log(`Source Customers: /${SOURCE_CUSTOMERS_PATH}`);
console.log(`Source Invoices: /${SOURCE_INVOICES_PATH}`);
console.log(`Destination Path: /${DEST_ROOT_PATH}`);
console.log('---');


async function migrateData() {
    const batch = db.batch();

    // --- Migrate Customers ---
    console.log('Migrating Customers...');
    const customersSnapshot = await db.collection(SOURCE_CUSTOMERS_PATH).get();
    let customerCount = 0;

    customersSnapshot.forEach(doc => {
        const data = doc.data();
        const newCustomerData = {
            name: data.customerName || data.name || 'Unknown Customer',
            email: data.email || '',
            phone: data.phone || '',
            address: data.address || '',
            notes: data.notes || '',
            debt: data.debt || 0,
            status: data.status || 'active',
            customerType: data.customerType || 'retail',
            createdAt: data.createdAt || admin.firestore.FieldValue.serverTimestamp(),
        };
        const newDocRef = db.collection(DEST_CUSTOMERS_PATH).doc(doc.id);
        batch.set(newDocRef, newCustomerData);
        customerCount++;
    });
    console.log(` -> Scheduled ${customerCount} customers for migration.`);


    // --- Migrate Invoices and Invoice Items ---
    console.log('\nMigrating Invoices and their Items...');
    const invoicesSnapshot = await db.collection(SOURCE_INVOICES_PATH).get();
    let invoiceCount = 0;
    let itemsCount = 0;

    invoicesSnapshot.forEach(doc => {
        const data = doc.data();
        const items = data.items || [];
        
        // Create the main invoice document at the new location
        const newInvoiceData = {
            invoiceNumber: data.invoiceNumber || '',
            customerId: data.customerId || '',
            customerName: data.customerName || 'Walk-In Customer',
            subtotal: data.subtotal || 0,
            tax: data.tax || 0,
            discount: data.discount || 0,
            total: data.totalAmount || data.total || 0,
            issueDate: data.date || data.issueDate || new Date().toISOString().split('T')[0],
            dueDate: data.dueDate || data.date || new Date().toISOString().split('T')[0],
            status: data.status || 'Paid',
            summary: data.summary || '',
            amountPaid: data.amountPaid || 0,
            paymentIds: data.paymentIds || [],
            createdAt: data.createdAt || admin.firestore.FieldValue.serverTimestamp(),
        };

        const newInvoiceRef = db.collection(DEST_INVOICES_PATH).doc(doc.id);
        batch.set(newInvoiceRef, newInvoiceData);
        invoiceCount++;

        // Create the invoice_items subcollection for the new invoice
        items.forEach((item, index) => {
            const newItemData = {
                id: item.id || `item-${index}`,
                productName: item.productName || 'Custom Item',
                description: item.description || '',
                quantity: item.quantity || 1,
                unitPrice: item.unitPrice || 0,
                total: item.total || (item.quantity * item.unitPrice),
                isCustom: item.isCustom !== undefined ? item.isCustom : true,
                inventoryId: item.inventoryId || null,
            };

            const newItemRef = newInvoiceRef.collection('invoice_items').doc(); // Auto-generate ID
            batch.set(newItemRef, newItemData);
            itemsCount++;
        });
    });
    console.log(` -> Scheduled ${invoiceCount} invoices for migration.`);
    console.log(` -> Scheduled ${itemsCount} invoice items for subcollection migration.`);

    // Commit all the changes at once
    console.log('\nCommitting all changes to the database...');
    await batch.commit();

    console.log('---');
    console.log('✅ Migration complete!');
    console.log(`Total customers migrated: ${customerCount}`);
    console.log(`Total invoices migrated: ${invoiceCount}`);
    console.log(`Total invoice items migrated to subcollections: ${itemsCount}`);

}

migrateData().catch(error => {
    console.error("Migration failed:", error);
});
