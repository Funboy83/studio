const admin = require('firebase-admin');

// --- Step 1: Configuration ---
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// --- Configuration: These are the two collections we need to read from ---
const SOURCE_INVOICES_PATH = 'invoices';
const SOURCE_INVOICE_ITEMS_PATH = 'invoice_items'; 

// --- Destination paths ---
const DEST_ROOT_PATH = 'wholease/data';
const DEST_INVOICES_PATH = `${DEST_ROOT_PATH}/invoices`;

console.log('Starting FINAL diagnostic migration script...');

async function migrateData() {
    const batch = db.batch();

    console.log(`Reading invoices from '${SOURCE_INVOICES_PATH}' and their items from '${SOURCE_INVOICE_ITEMS_PATH}'...`);
    const invoicesSnapshot = await db.collection(SOURCE_INVOICES_PATH).get();
    let invoiceCount = 0;
    let itemsCount = 0;

    for (const invoiceDoc of invoicesSnapshot.docs) {
        const invoiceData = invoiceDoc.data();
        
        // --- DEBUG: Announce which invoice we are processing ---
        console.log(`\nProcessing Invoice ID: ${invoiceDoc.id}`);

        const newInvoiceRef = db.collection(DEST_INVOICES_PATH).doc(invoiceDoc.id);
        const newInvoiceData = {
            invoiceNumber: invoiceData.invoiceNumber || '',
            customerId: invoiceData.customerId || '',
            customerName: invoiceData.customerName || 'Walk-In Customer',
            total: invoiceData.totalAmount || invoiceData.total || 0,
            issueDate: invoiceData.date || invoiceData.issueDate || '2025-09-14',
        };
        batch.set(newInvoiceRef, newInvoiceData);
        invoiceCount++;

        // --- Find all items belonging to this specific invoice ---
        const itemsQuerySnapshot = await db.collection(SOURCE_INVOICE_ITEMS_PATH)
                                          .where('invoiceId', '==', invoiceDoc.id)
                                          .get();
        
        // --- DEBUG: Report if we found any items ---
        if (itemsQuerySnapshot.empty) {
            console.log(` -> ❌ WARNING: No items found for this invoice. Please check your '/invoice_items' collection for any document that has an 'invoiceId' field with the value '${invoiceDoc.id}'.`);
        } else {
            console.log(` -> ✅ SUCCESS: Found ${itemsQuerySnapshot.size} item(s) for this invoice.`);
            itemsQuerySnapshot.forEach(itemDoc => {
                const item = itemDoc.data();

                const newItemData = {
                    name: item.name || 'Item Name Missing',
                    quantity: item.quantity || 1,
                    unitPrice: item.unitPrice || 0,
                    lineTotal: item.lineTotal || 0,
                    description: item.description || '',
                };
                
                const newItemRef = newInvoiceRef.collection('invoice_items').doc(itemDoc.id);
                batch.set(newItemRef, newItemData);
                itemsCount++;
            });
        }
    }
    
    console.log(`\n--------------------------------------------------`);
    console.log(`Scheduled ${invoiceCount} invoices for migration.`);
    console.log(`Found and scheduled ${itemsCount} total invoice items.`);

    console.log('\nCommitting all changes to the database...');
    await batch.commit();

    console.log('---');
    console.log('✅ Migration complete!');
}

migrateData().catch(error => {
    console.error("Migration failed:", error);
});