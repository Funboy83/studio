
// This is a one-time migration script to be run with Node.js.
// It fixes existing invoice documents in Firestore to match the application's expected data structure.
// Specifically, it renames 'date' to 'issueDate', 'totalAmount' to 'total', and adds missing fields.
//
// === IMPORTANT: THIS SCRIPT MODIFIES YOUR DATA IN-PLACE ===
// This script will directly update your invoice documents in the specified path.
// It is recommended to back up your data before running this script if you are unsure.
// ==========================================================

// ====== SETUP ======
// 1. If you haven't already, install Firebase Admin SDK:
//    npm install firebase-admin
//
// 2. Make sure your Service Account Key file is in the project root:
//    - It should be named "serviceAccountKey.json".
//
// 3. Configure the path to your invoices below.
//
// 4. Run the script from your project's root directory:
//    node fix-invoices-script.js
// ===================

const admin = require('firebase-admin');

// --- Step 1: Configuration ---
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// Define where your invoices are stored.
const invoicesCollectionPath = 'wholease/data/invoices';
console.log(`Targeting invoices collection at: ${invoicesCollectionPath}`);


// --- Step 2: Main Migration Function ---
async function fixInvoiceData() {
  console.log('Starting Firestore invoice data fix...');
  console.log('NOTE: This script will modify your invoice documents in-place.');

  const invoicesCollection = db.collection(invoicesCollectionPath);
  const snapshot = await invoicesCollection.get();

  if (snapshot.empty) {
    console.log('No invoices found in the specified collection. Nothing to do.');
    return;
  }

  // Use a batch to perform all writes at once for efficiency and atomicity.
  const batch = db.batch();
  let updatedCount = 0;

  snapshot.docs.forEach(doc => {
    const invoiceData = doc.data();
    let needsUpdate = false;
    const updates = {};

    // 1. Rename 'date' to 'issueDate'
    if (invoiceData.date && !invoiceData.issueDate) {
      updates.issueDate = invoiceData.date;
      updates.date = admin.firestore.FieldValue.delete(); // Remove the old field
      needsUpdate = true;
    }
    
    // 2. Rename 'totalAmount' to 'total'
    if (invoiceData.totalAmount !== undefined && invoiceData.total === undefined) {
      updates.total = invoiceData.totalAmount;
      updates.totalAmount = admin.firestore.FieldValue.delete(); // Remove the old field
      needsUpdate = true;
    }
    
    // 3. Add missing required fields with default values
    if (invoiceData.dueDate === undefined) {
      updates.dueDate = invoiceData.date || new Date().toISOString().split('T')[0]; // Default to issueDate or today
      needsUpdate = true;
    }
    if (invoiceData.discount === undefined) {
      updates.discount = 0;
      needsUpdate = true;
    }
    if (invoiceData.amountPaid === undefined) {
      updates.amountPaid = 0;
      needsUpdate = true;
    }
    if (invoiceData.paymentIds === undefined) {
        updates.paymentIds = [];
        needsUpdate = true;
    }
     if (invoiceData.customerName === undefined && invoiceData.customerId) {
        updates.customerName = "Walk-In Customer"; // Add default name if missing
        needsUpdate = true;
    }


    if (needsUpdate) {
      console.log(`  -> Scheduling update for invoice ID: ${doc.id}`);
      batch.update(doc.ref, updates);
      updatedCount++;
    }
  });

  if (updatedCount > 0) {
    await batch.commit();
    console.log(`---`);
    console.log(`✅ Successfully updated ${updatedCount} invoice documents.`);
  } else {
    console.log(`---`);
    console.log('✅ All invoice documents already seem to be in the correct format.');
  }
}

// --- Step 3: Run the Script ---
fixInvoiceData().catch(console.error);
