
// This is a one-time migration script to be run with Node.js.
// It copies data from the root of your Firestore database to a new, specified path,
// and restructures the `invoice_items` to be a subcollection of `invoices`.
//
// === IMPORTANT: THIS IS A NON-DESTRUCTIVE SCRIPT ===
// This script ONLY reads your existing data and creates a copy in a new location.
// It does NOT delete, remove, or modify your original data in any way.
// Your source data at the root of Firestore will remain untouched.
// ===================================================

// ====== SETUP ======
// 1. Install Firebase Admin SDK:
//    npm install firebase-admin
//
// 2. Get your Service Account Key:
//    - Go to your Firebase project settings > Service accounts.
//    - Click "Generate new private key" and download the JSON file.
//    - Place the downloaded file in the root of this project and rename it to "serviceAccountKey.json".
//
// 3. Configure Paths:
//    - Set the `destinationPath` below to where you want the new data to live.
//
// 4. Run the script:
//    node migration-script.js
// ===================

const admin = require('firebase-admin');

// --- Step 1: Configuration ---
const serviceAccount = require('./serviceAccountKey.json'); // **IMPORTANT**: Replace with your key file.

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// Define where the new, structured data will be stored.
const destinationPath = 'wholease/data';
console.log(`Destination path set to: ${destinationPath}`);


// --- Step 2: Main Migration Function ---
async function migrateData() {
  console.log('Starting Firestore data migration...');
  console.log('NOTE: This is a NON-DESTRUCTIVE copy. Original data will NOT be deleted.');

  // --- Migrate Simple Collections ---
  // These collections can be copied directly.
  await migrateCollection('customers', `${destinationPath}/customers`);
  await migrateCollection('inventory', `${destinationPath}/inventory`);
  await migrateCollection('options_brand', `${destinationPath}/options_brand`);
  await migrateCollection('options_carrier', `${destinationPath}/options_carrier`);
  await migrateCollection('options_color', `${destinationPath}/options_color`);
  await migrateCollection('options_condition', `${destinationPath}/options_condition`);
  await migrateCollection('options_grade', `${destinationPath}/options_grade`);
  await migrateCollection('options_storage', `${destinationPath}/options_storage`);
  
  // --- Migrate Invoices and Restructure Items ---
  await migrateInvoicesAndItems('invoices', 'invoice_items', `${destinationPath}/invoices`);

  console.log('---');
  console.log('✅ Data migration (copy) completed successfully!');
  console.log('Your original data remains untouched.');
}


// --- Step 3: Helper Functions ---

/**
 * Copies a collection from a source path to a destination path.
 * This function does NOT delete the source documents.
 */
async function migrateCollection(sourceCollectionName, destinationCollectionPath) {
  console.log(`Copying collection: ${sourceCollectionName}...`);
  const sourceCollection = db.collection(sourceCollectionName);
  const destinationCollection = db.collection(destinationCollectionPath);
  const snapshot = await sourceCollection.get();

  if (snapshot.empty) {
    console.log(`  -> No documents found in ${sourceCollectionName}. Skipping.`);
    return;
  }

  // Use a batch to write the new documents. No delete operations are included.
  const batch = db.batch();
  snapshot.docs.forEach(doc => {
    const newDocRef = destinationCollection.doc(doc.id);
    batch.set(newDocRef, doc.data());
  });

  await batch.commit();
  console.log(`  -> Copied ${snapshot.size} documents to ${destinationCollectionPath}.`);
}


/**
 * Migrates invoices and restructures their items as a subcollection.
 * This function does NOT delete the source invoices or items.
 */
async function migrateInvoicesAndItems(sourceInvoices, sourceItems, destinationInvoicesPath) {
  console.log('Copying invoices and restructuring items...');
  const itemsSnapshot = await db.collection(sourceItems).get();
  const invoicesSnapshot = await db.collection(sourceInvoices).get();

  // Group all items by their invoiceId
  const itemsByInvoiceId = new Map();
  itemsSnapshot.forEach(doc => {
    const item = doc.data();
    if (item.invoiceId) {
      if (!itemsByInvoiceId.has(item.invoiceId)) {
        itemsByInvoiceId.set(item.invoiceId, []);
      }
      itemsByInvoiceId.get(item.invoiceId).push({id: doc.id, ...item});
    }
  });
  console.log(`  -> Found and grouped items for ${itemsByInvoiceId.size} invoices.`);

  if (invoicesSnapshot.empty) {
      console.log('  -> No invoices found to copy. Skipping.');
      return;
  }

  // Use a batched write to handle all new invoices and their new items efficiently.
  const batch = db.batch();

  invoicesSnapshot.docs.forEach(invoiceDoc => {
    const invoiceData = invoiceDoc.data();
    const invoiceId = invoiceDoc.id;

    // Set the main invoice document in the new location.
    const newInvoiceRef = db.collection(destinationInvoicesPath).doc(invoiceId);
    batch.set(newInvoiceRef, invoiceData);

    // Now, add its items to the subcollection.
    const items = itemsByInvoiceId.get(invoiceId) || [];
    if (items.length > 0) {
      items.forEach(item => {
        // Create a ref for the new item in the subcollection of the new invoice.
        const newItemRef = newInvoiceRef.collection('invoice_items').doc(item.id);
        // The line below creates a new object `itemData` without the `invoiceId` field.
        // It does NOT modify the original item object.
        const { invoiceId, ...itemData } = item;
        batch.set(newItemRef, itemData);
      });
    }
  });

  await batch.commit();
  console.log(`  -> Copied ${invoicesSnapshot.size} invoices and their items to ${destinationInvoicesPath}.`);
}


// --- Step 4: Run the Script ---
migrateData().catch(console.error);


