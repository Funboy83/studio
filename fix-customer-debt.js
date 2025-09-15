
// This is a one-time script to recalculate and fix customer debt.
// It reads all 'Unpaid' and 'Partial' invoices and updates the 'debt' field on each customer.
//
// ====== SETUP ======
// 1. If you haven't already, install Firebase Admin SDK:
//    npm install firebase-admin
//
// 2. Make sure your Service Account Key file is in the project root:
//    - It should be named "serviceAccountKey.json".
//
// 3. Run the script from your project's root directory:
//    node fix-customer-debt.js
// ===================

const admin = require('firebase-admin');

// --- Configuration ---
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

const CUSTOMERS_PATH = 'wholease/data/customers';
const INVOICES_PATH = 'wholease/data/invoices';

async function fixCustomerDebt() {
  console.log('Starting customer debt recalculation...');
  
  const invoicesSnapshot = await db.collection(INVOICES_PATH).get();
  const customerDebts = new Map();

  // 1. Calculate the correct debt for each customer from invoices
  console.log('Calculating correct debt from all invoices...');
  invoicesSnapshot.forEach(doc => {
    const invoice = doc.data();
    if (invoice.status === 'Unpaid' || invoice.status === 'Partial') {
      const customerId = invoice.customerId;
      const amountDue = invoice.total - (invoice.amountPaid || 0);

      if (customerId) {
        const currentDebt = customerDebts.get(customerId) || 0;
        customerDebts.set(customerId, currentDebt + amountDue);
      }
    }
  });
  console.log(`Found debt information for ${customerDebts.size} customers.`);

  // 2. Update each customer document with the correct debt
  const customersSnapshot = await db.collection(CUSTOMERS_PATH).get();
  const batch = db.batch();
  let updatedCount = 0;

  console.log('Scheduling updates for customer documents...');
  for (const customerDoc of customersSnapshot.docs) {
    const customerId = customerDoc.id;
    const currentDebt = customerDoc.data().debt || 0;
    const correctDebt = customerDebts.get(customerId) || 0;

    // Only update if the debt is incorrect
    if (currentDebt !== correctDebt) {
      const customerRef = db.collection(CUSTOMERS_PATH).doc(customerId);
      batch.update(customerRef, { debt: correctDebt });
      console.log(`  -> Scheduling update for ${customerDoc.data().name} (ID: ${customerId}). New Debt: ${correctDebt.toFixed(2)}`);
      updatedCount++;
    }
  }

  if (updatedCount > 0) {
    await batch.commit();
    console.log(`\n✅ Successfully updated the debt for ${updatedCount} customers.`);
  } else {
    console.log('\n✅ All customer debts are already correct. No updates needed.');
  }
}

fixCustomerDebt().catch(console.error);
