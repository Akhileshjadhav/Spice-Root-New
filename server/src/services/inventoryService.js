import { getFirebaseAdmin } from "./firebaseAdmin.js";
import { HttpError } from "../utils/http.js";

function normalizeLineItems(items = []) {
  return items
    .map((item) => ({
      productId: String(item.documentId || item.id || item.slug || "").trim(),
      quantity: Math.max(0, Number(item.quantity) || 0),
    }))
    .filter((item) => item.productId && item.quantity > 0);
}

export async function decrementProductStock(items = []) {
  const lineItems = normalizeLineItems(items);

  if (lineItems.length === 0) {
    return { updated: [] };
  }

  const { db, FieldValue } = await getFirebaseAdmin();
  const updated = [];

  for (const lineItem of lineItems) {
    const productRef = db.collection("products").doc(lineItem.productId);
    const snapshot = await productRef.get();

    if (!snapshot.exists) {
      continue;
    }

    const currentStock = Math.max(0, Number(snapshot.data()?.stock) || 0);
    const nextStock = Math.max(0, currentStock - lineItem.quantity);

    await productRef.set(
      {
        stock: nextStock,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    updated.push({
      productId: lineItem.productId,
      previousStock: currentStock,
      nextStock,
      quantity: lineItem.quantity,
    });
  }

  return { updated };
}

export async function decrementProductStockForUser(user, items = []) {
  if (!user?.uid) {
    throw new HttpError(401, "Login is required.");
  }

  return decrementProductStock(items);
}
