// --- (REPLACE THIS ENTIRE SECTION IN YOUR SCRIPT) ---

// --- Migrate Invoices and Invoice Items ---
console.log('\nMigrating Invoices and their Items...');
const invoicesSnapshot = await db.collection(SOURCE_INVOICES_PATH).get();
let invoiceCount = 0;
let itemsCount = 0;

// Use a for...of loop to handle asynchronous operations inside
for (const doc of invoicesSnapshot.docs) {
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
        // THIS IS THE CORRECTED PART
        const newItemData = {
            // --- Corrected Fields ---
            name: item.name || item.productName || 'Custom Item', // CORRECTED: Uses 'name' now
            lineTotal: item.lineTotal || item.total || (item.quantity * item.unitPrice), // CORRECTED: Uses 'lineTotal'

            // --- Added Missing Fields (adjust if your old field names are different) ---
            pictureUrl: item.pictureUrl || item.picture || '', // ADDED: For the product image
            category: item.category || 'Uncategorized',     // ADDED: For product category

            // --- Existing Fields ---
            id: item.id || `item-${index}`,
            description: item.description || '',
            quantity: item.quantity || 1,
            unitPrice: item.unitPrice || 0,
            isCustom: item.isCustom !== undefined ? item.isCustom : true,
            inventoryId: item.inventoryId || null,
        };

        const newItemRef = newInvoiceRef.collection('invoice_items').doc(); // Auto-generate ID
        batch.set(newItemRef, newItemData);
        itemsCount++;
    });
}; // End of the loop
console.log(` -> Scheduled ${invoiceCount} invoices for migration.`);
console.log(` -> Scheduled ${itemsCount} invoice items for subcollection migration.`);

// --- (END OF REPLACEMENT) ---