import { initializeApp } from "firebase/app";
import { getFirestore, collectionGroup, getDocs } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "mock-api-key",
  authDomain: "localhost",
  projectId: "spice-root",
  storageBucket: "spice-root.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:123456789"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function testQuery() {
  try {
    console.log("Querying orders collection group...");
    const snap = await getDocs(collectionGroup(db, "orders"));
    console.log(`Found ${snap.docs.length} orders.`);
  } catch (error) {
    console.error("Query failed:", error);
  }
}

testQuery();
