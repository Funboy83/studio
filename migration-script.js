
// This is a one-time migration script to be run with Node.js.
// It fixes existing customer documents in Firestore to match the application's expected data structure.
// Specifically, it renames 'customerName' to 'name' and adds missing 'debt' and 'status' fields.
//
// === IMPORTANT: THIS SCRIPT MODIFIES YOUR DATA IN-PLACE ===
// This script will directly update your customer documents in the specified path.
// It is recommended to back up your data before running this script if you are unsure.
// ==========================================================

// ====== SETUP ======
// 1. If you haven't already, install Firebase Admin SDK:
//    npm install firebase-admin
//
// 2. Make sure your Service Account Key file is in the project root:
//    - It should be named "serviceAccountKey.json".
//
// 3. Configure the path to your customers below.
//
// 4. Run the script from your project's root directory:
//    node fix-customers-script.js
// ===================

const admin = require('firebase-admin');

// --- Step 1: Configuration ---
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// Define where your customers are stored.
const customersCollectionPath = 'wholease/data/customers';
console.log(`Targeting customers collection at: ${customersCollectionPath}`);


// --- Step 2: Main Migration Function ---
async function fixCustomerData() {
  console.log('Starting Firestore customer data fix...');
  console.log('NOTE: This script will modify your customer documents in-place.');

  const customersCollection = db.collection(customersCollectionPath);
  const snapshot = await customersCollection.get();

  if (snapshot.empty) {
    console.log('No customers found in the specified collection. Nothing to do.');
    return;
  }

  // Use a batch to perform all writes at once for efficiency and atomicity.
  const batch = db.batch();
  let updatedCount = 0;

  snapshot.docs.forEach(doc => {
    const customerData = doc.data();
    let needsUpdate = false;
    const updates = {};

    // 1. Rename 'customerName' to 'name'
    if (customerData.customerName && !customerData.name) {
      updates.name = customerData.customerName;
      updates.customerName = admin.firestore.FieldValue.delete(); // Remove the old field
      needsUpdate = true;
    }
    
    // 2. Add missing required fields with default values
    if (customerData.debt === undefined) {
      updates.debt = 0;
      needsUpdate = true;
    }
    if (customerData.status === undefined) {
      updates.status = 'active';
      needsUpdate = true;
    }


    if (needsUpdate) {
      console.log(`  -> Scheduling update for customer ID: ${doc.id}`);
      batch.update(doc.ref, updates);
      updatedCount++;
    }
  });

  if (updatedCount > 0) {
    await batch.commit();
    console.log(`---`);
    console.log(`✅ Successfully updated ${updatedCount} customer documents.`);
  } else {
    console.log(`---`);
    console.log('✅ All customer documents already seem to be in the correct format.');
  }
}

// --- Step 3: Run the Script ---
fixCustomerData().catch(console.error);
