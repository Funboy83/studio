
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
const SOURCE_INVOICE_ITEMS_PATH = 'invoice_items'; 

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

    for (const invoiceDoc of invoicesSnapshot.docs) {
        const data = invoiceDoc.data();
        
        const newInvoiceData = {
            invoiceNumber: data.invoiceNumber || '',
            customerId: data.customerId || '',
            customerName: data.customerName || 'Walk-In Customer',
            subtotal: data.subtotal || data.totalAmount || data.total || 0,
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

        const newInvoiceRef = db.collection(DEST_INVOICES_PATH).doc(invoiceDoc.id);
        batch.set(newInvoiceRef, newInvoiceData);
        invoiceCount++;

        const itemsQuerySnapshot = await db.collection(SOURCE_INVOICE_ITEMS_PATH)
                                          .where('invoiceId', '==', invoiceDoc.id)
                                          .get();
        
        if (itemsQuerySnapshot.empty) {
            console.log(` -> ❌ WARNING: No items found for invoice ${invoiceDoc.id}.`);
        } else {
            console.log(` -> ✅ Found ${itemsQuerySnapshot.size} item(s) for invoice ${invoiceDoc.id}.`);
            itemsQuerySnapshot.forEach(itemDoc => {
                const item = itemDoc.data();

                const newItemData = {
                    productName: item.name || item.productName || 'Custom Item',
                    description: item.description || '',
                    quantity: item.quantity || 1,
                    unitPrice: item.unitPrice || 0,
                    total: item.lineTotal || item.total || (item.quantity * item.unitPrice) || 0,
                    isCustom: item.isCustom !== undefined ? item.isCustom : true,
                    inventoryId: item.inventoryId || null,
                };
                
                const newItemRef = newInvoiceRef.collection('invoice_items').doc(itemDoc.id);
                batch.set(newItemRef, newItemData);
                itemsCount++;
            });
        }
    }
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
