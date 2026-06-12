import { useEffect, useRef, useState } from "react";
import { doc, setDoc } from "firebase/firestore";
import { db, serverTimestamp } from "../firebase";
import CartContext from "./cartContext";
import { useAuth } from "./useAuth";
import {
  calculateCouponDiscount,
  findApplicableCoupon,
  subscribeToCoupons,
} from "../lib/offers";
import { subscribeSafely } from "../lib/firestoreSubscriptions";
import { showSiteToast } from "../lib/siteToast";

function getStorageKey(uid) {
  return `spice-root-cart:${uid}`;
}

function createItemKey(productId, size) {
  return `${productId}::${size || "default"}`;
}

function getCartDocRef(uid) {
  return doc(db, "users", uid, "cart", "current");
}

function normalizeCartItem(item) {
  return {
    key: item.key,
    id: item.id,
    name: item.name,
    image: item.image,
    price: Number(item.price) || 0,
    unit: item.unit || "1 KG",
    size: item.size || "",
    quantity: Math.max(1, Number(item.quantity) || 1),
  };
}

function readStoredCart(uid) {
  if (typeof window === "undefined" || !uid) {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(getStorageKey(uid));

    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(normalizeCartItem) : [];
  } catch {
    return [];
  }
}

function mergeCartItems(primaryItems = [], secondaryItems = []) {
  const merged = new Map();

  [...primaryItems, ...secondaryItems].forEach((item) => {
    const normalized = normalizeCartItem(item);
    const existing = merged.get(normalized.key);

    if (existing) {
      merged.set(normalized.key, {
        ...existing,
        quantity: Math.max(existing.quantity, normalized.quantity),
      });
      return;
    }

    merged.set(normalized.key, normalized);
  });

  return Array.from(merged.values());
}

function serializeCartItems(cartItems) {
  return JSON.stringify((cartItems || []).map(normalizeCartItem));
}

function serializeCartState(cartItems, couponCode) {
  return JSON.stringify({
    items: (cartItems || []).map(normalizeCartItem),
    couponCode: couponCode || "",
  });
}

export function CartProvider({ children }) {
  const { currentUser, isAuthenticated } = useAuth();
  const [items, setItems] = useState([]);
  const [coupons, setCoupons] = useState([]);
  const [appliedCouponCode, setAppliedCouponCode] = useState("");
  const [hasLoadedRemoteCart, setHasLoadedRemoteCart] = useState(false);
  const hadLocalChangesBeforeHydration = useRef(false);
  const lastRemoteCartSignature = useRef("");

  useEffect(() => {
    const unsubscribe = subscribeToCoupons(
      setCoupons,
      (error) => console.error("Failed to load coupons for cart:", error)
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !currentUser?.uid) {
      const resetTimer = window.setTimeout(() => {
        setItems([]);
        setAppliedCouponCode("");
        setHasLoadedRemoteCart(false);
        hadLocalChangesBeforeHydration.current = false;
      }, 0);

      return () => window.clearTimeout(resetTimer);
    }

    const cachedItems = readStoredCart(currentUser.uid);
    const cachedItemsTimer = window.setTimeout(() => {
      setItems(cachedItems);
    }, 0);

    const unsubscribe = subscribeSafely(
      getCartDocRef(currentUser.uid),
      (snapshot) => {
        const remoteItems = snapshot.exists()
          ? Array.isArray(snapshot.data()?.items)
            ? snapshot.data().items.map(normalizeCartItem)
            : []
          : [];
        const remoteCouponCode = snapshot.exists() ? snapshot.data()?.couponCode || "" : "";
        const remoteSignature = serializeCartState(remoteItems, remoteCouponCode);
        lastRemoteCartSignature.current = remoteSignature;

        setAppliedCouponCode(remoteCouponCode);
        setItems((current) => {
          const nextItems = hadLocalChangesBeforeHydration.current
            ? mergeCartItems(remoteItems, current)
            : remoteItems;

          return serializeCartItems(current) === serializeCartItems(nextItems) ? current : nextItems;
        });
        setHasLoadedRemoteCart(true);
        hadLocalChangesBeforeHydration.current = false;
      },
      (error) => {
        console.error("Failed to load cart from Firestore:", error);
        setHasLoadedRemoteCart(true);
      }
    );

    return () => {
      window.clearTimeout(cachedItemsTimer);
      unsubscribe();
    };
  }, [currentUser?.uid, isAuthenticated]);

  useEffect(() => {
    if (typeof window === "undefined" || !isAuthenticated || !currentUser?.uid) {
      return;
    }

    window.localStorage.setItem(getStorageKey(currentUser.uid), JSON.stringify(items));
  }, [currentUser?.uid, isAuthenticated, items]);

  useEffect(() => {
    if (!isAuthenticated || !currentUser?.uid || !hasLoadedRemoteCart) {
      return;
    }

    const itemSignature = serializeCartState(items, appliedCouponCode);

    if (itemSignature === lastRemoteCartSignature.current) {
      return;
    }

    setDoc(
      getCartDocRef(currentUser.uid),
      {
        items,
        couponCode: appliedCouponCode,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    ).catch((error) => {
      console.error("Failed to save cart to Firestore:", error);
    });
  }, [appliedCouponCode, currentUser?.uid, hasLoadedRemoteCart, isAuthenticated, items]);

  const markPendingHydrationChange = () => {
    if (!hasLoadedRemoteCart) {
      hadLocalChangesBeforeHydration.current = true;
    }
  };

  const addItem = (product, quantity = 1, size = "") => {
    if (!isAuthenticated || !product?.id) {
      return false;
    }

    const key = createItemKey(product.id, size);
    markPendingHydrationChange();

    setItems((current) => {
      const existingItem = current.find((item) => item.key === key);

      if (existingItem) {
        return current.map((item) =>
          item.key === key
            ? { ...item, quantity: item.quantity + Math.max(1, quantity) }
            : item
        );
      }

      return [
        ...current,
        normalizeCartItem({
          key,
          id: product.id,
          name: product.name,
          image: product.image,
          price: product.price,
          unit: product.unit,
          size,
          quantity,
        }),
      ];
    });

    showSiteToast("Product added to cart.");
    return true;
  };

  const updateQuantity = (itemKey, quantity) => {
    const nextQuantity = Math.max(1, Number(quantity) || 1);
    markPendingHydrationChange();

    setItems((current) =>
      current.map((item) =>
        item.key === itemKey ? { ...item, quantity: nextQuantity } : item
      )
    );
  };

  const increaseQuantity = (itemKey) => {
    markPendingHydrationChange();
    setItems((current) =>
      current.map((item) =>
        item.key === itemKey ? { ...item, quantity: item.quantity + 1 } : item
      )
    );
  };

  const decreaseQuantity = (itemKey) => {
    markPendingHydrationChange();
    setItems((current) =>
      current
        .map((item) =>
          item.key === itemKey ? { ...item, quantity: item.quantity - 1 } : item
        )
        .filter((item) => item.quantity > 0)
    );
  };

  const removeItem = (itemKey) => {
    markPendingHydrationChange();
    setItems((current) => current.filter((item) => item.key !== itemKey));
    showSiteToast("Product removed from cart.");
  };

  const clearCart = () => {
    markPendingHydrationChange();
    setItems([]);
    setAppliedCouponCode("");
    showSiteToast("Cart cleared.");
  };

  const itemCount = items.reduce((total, item) => total + item.quantity, 0);
  const subtotal = items.reduce((total, item) => total + item.price * item.quantity, 0);
  const appliedCoupon = findApplicableCoupon(coupons, appliedCouponCode, subtotal);
  const discountAmount = calculateCouponDiscount(appliedCoupon, subtotal, 0);
  const total = Math.max(0, subtotal - discountAmount);

  const applyCoupon = (code) => {
    const coupon = findApplicableCoupon(coupons, code, subtotal);

    if (!coupon) {
      return {
        success: false,
        message: "Coupon is invalid, expired, inactive, or not applicable for this cart.",
      };
    }

    markPendingHydrationChange();
    setAppliedCouponCode(coupon.code);
    showSiteToast(`${coupon.code} applied successfully.`);

    return {
      success: true,
      message: `${coupon.code} applied successfully.`,
    };
  };

  const removeCoupon = () => {
    markPendingHydrationChange();
    setAppliedCouponCode("");
    showSiteToast("Coupon removed.");
  };

  const value = {
    items,
    itemCount,
    subtotal,
    appliedCoupon,
    appliedCouponCode,
    discountAmount,
    total,
    addItem,
    updateQuantity,
    increaseQuantity,
    decreaseQuantity,
    removeItem,
    clearCart,
    applyCoupon,
    removeCoupon,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}
