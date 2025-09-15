
// This script updates the status of all invoices in the Firestore database to 'Unpaid'.
// It is intended for a one-time use to reset invoice statuses for processing.
//
// === IMPORTANT: THIS SCRIPT MODIFIES YOUR DATA IN-PLACE ===
// It is recommended to back up your data before running this script if you are unsure.
// ==========================================================

// ====== SETUP ======
// 1. If you haven't already, install Firebase Admin SDK:
//    npm install firebase-admin
//
// 2. Make sure your Service Account Key file is in the project root:
//    - It should be named "serviceAccountKey.json".
//
// 3. Run the script from your project's root directory:
//    node update-invoices-status.js
// ===================

const admin = require('firebase-admin');

// --- Step 1: Configuration ---
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

const invoicesCollectionPath = 'wholease/data/invoices';
console.log(`Targeting invoices collection at: ${invoicesCollectionPath}`);


// --- Step 2: Main Update Function ---
async function updateInvoiceStatuses() {
  console.log('Starting invoice status update...');
  console.log('NOTE: This script will set the status of ALL invoices to "Unpaid".');

  const invoicesCollection = db.collection(invoicesCollectionPath);
  const snapshot = await invoicesCollection.get();

  if (snapshot.empty) {
    console.log('No invoices found in the specified collection. Nothing to do.');
    return;
  }

  const batch = db.batch();
  let updatedCount = 0;

  snapshot.docs.forEach(doc => {
    console.log(`  -> Scheduling update for invoice ID: ${doc.id}`);
    batch.update(doc.ref, { status: 'Unpaid' });
    updatedCount++;
  });

  if (updatedCount > 0) {
    await batch.commit();
    console.log(`---`);
    console.log(`✅ Successfully updated ${updatedCount} invoice documents to 'Unpaid'.`);
  } else {
    console.log(`---`);
    console.log('No invoices needed an update.');
  }
}

// --- Step 3: Run the Script ---
updateInvoiceStatuses().catch(console.error);
