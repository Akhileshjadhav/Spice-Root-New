import { useEffect, useMemo, useState } from "react";
import { collection, doc, setDoc } from "firebase/firestore";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../context/useAuth";
import { useCart } from "../../context/useCart";
import Footer from "../../components/Footer";
import { db, serverTimestamp } from "../../firebase";
import { formatPrice, formatProductMeta } from "../../lib/catalog";
import { createAdminOrderNotification } from "../../lib/adminStore";
import { buildCheckoutOrderStatusPayload } from "../../lib/orderStatus";
import {
  createOptimisticOrder,
  mergeOrdersWithCurrent,
  subscribeToUserOrders,
} from "../../lib/userOrders";
import { markCouponUsed } from "../../lib/offers";
import { apiRequest } from "../../lib/apiClient";
import { showSiteToast } from "../../lib/siteToast";
import OrderHistoryPanel from "../components/OrderHistoryPanel";
import Navbar from "../components/Navbar";
import "../../styles/products-listing.css";
import "../../styles/luxury-spice.css";
import "../../styles/navbar-final.css";

const RAZORPAY_CHECKOUT_SRC = "https://checkout.razorpay.com/v1/checkout.js";
const ALLOW_LOCAL_PAYMENT_FALLBACK = import.meta.env.DEV;

function createLocalRazorpayMockOrder(amount) {
  return {
    keyId: "",
    razorpayOrderId: "",
    amount: Math.max(1, Math.round(Number(amount || 0) * 100)),
    currency: "INR",
    mock: true,
    localMock: true,
  };
}

function createLocalRazorpayMockPayment() {
  const timestamp = Date.now();

  return {
    paymentId: `rzp_mock_paid_${timestamp}`,
    razorpayOrderId: "",
    razorpaySignature: "",
    mock: true,
    localMock: true,
  };
}

function loadRazorpayCheckout() {
  if (window.Razorpay) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const existingScript = document.querySelector(`script[src="${RAZORPAY_CHECKOUT_SRC}"]`);

    if (existingScript) {
      existingScript.addEventListener("load", resolve, { once: true });
      existingScript.addEventListener("error", reject, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = RAZORPAY_CHECKOUT_SRC;
    script.async = true;
    script.onload = resolve;
    script.onerror = reject;
    document.body.appendChild(script);
  });
}

async function createRazorpayOrderOnServer({ user, amount, customer, orderDocumentId }) {
  try {
    return await apiRequest("/razorpay/create-order", {
      user,
      method: "POST",
      body: JSON.stringify({
        amount,
        currency: "INR",
        orderDocumentId,
        customerEmail: customer.email,
      }),
    });
  } catch (error) {
    if (!ALLOW_LOCAL_PAYMENT_FALLBACK) {
      throw error;
    }

    console.warn("Razorpay server order failed, using local dev payment fallback:", error);
    const config = await apiRequest("/razorpay/config", { user }).catch(() => ({}));

    return {
      ...createLocalRazorpayMockOrder(amount),
      keyId: config.keyId || import.meta.env.VITE_RAZORPAY_KEY_ID || "",
    };
  }
}

async function verifyRazorpayPaymentOnServer(user, paymentResult) {
  try {
    return await apiRequest("/razorpay/verify-payment", {
      user,
      method: "POST",
      body: JSON.stringify(paymentResult),
    });
  } catch (error) {
    if (ALLOW_LOCAL_PAYMENT_FALLBACK && paymentResult.localMock) {
      console.warn("Razorpay server verification failed, using local dev payment fallback:", error);
      return {
        verified: true,
        paymentId: paymentResult.paymentId,
        razorpayOrderId: paymentResult.razorpayOrderId || "",
        razorpaySignature: paymentResult.razorpaySignature || "",
      };
    }

    throw error;
  }
}

async function openRazorpayTestCheckout({ amount, customer, orderId, keyId, razorpayOrderId, mock }) {
  const checkoutKeyId = keyId || import.meta.env.VITE_RAZORPAY_KEY_ID || "";

  if (!checkoutKeyId) {
    throw new Error("Payment gateway is not configured. Contact support or try again later.");
  }

  if (!checkoutKeyId.startsWith("rzp_test_") && import.meta.env.PROD) {
    throw new Error("Razorpay checkout is configured for test keys only in this app.");
  }

  const checkoutOrderId = mock ? "" : razorpayOrderId;

  if (!mock && !checkoutOrderId) {
    throw new Error("Razorpay test order could not be created. Please try again.");
  }

  try {
    await loadRazorpayCheckout();
  } catch (error) {
    if (ALLOW_LOCAL_PAYMENT_FALLBACK && mock) {
      console.warn("Razorpay checkout script failed, using local dev payment fallback:", error);
      return createLocalRazorpayMockPayment();
    }

    throw error;
  }

  if (!window.Razorpay) {
    if (ALLOW_LOCAL_PAYMENT_FALLBACK && mock) {
      return createLocalRazorpayMockPayment();
    }

    throw new Error("Razorpay checkout could not be loaded.");
  }

  return new Promise((resolve, reject) => {
    let lastPaymentFailure = "";
    const checkout = new window.Razorpay({
      key: checkoutKeyId,
      amount: Math.max(1, Math.round(Number(amount || 0) * 100)),
      currency: "INR",
      name: "Spice Root",
      description: mock ? "Razorpay demo test payment" : "Razorpay test payment",
      ...(checkoutOrderId ? { order_id: checkoutOrderId } : {}),
      prefill: {
        name: customer.fullName,
        email: customer.email,
        contact: customer.mobileNumber,
      },
      notes: {
        orderDocumentId: orderId,
        mode: "test",
      },
      theme: {
        color: "#b45309",
      },
      retry: {
        enabled: true,
        max_count: 3,
      },
      remember_customer: false,
      handler: (response) => {
        resolve({
          paymentId: response.razorpay_payment_id || `rzp_test_paid_${Date.now()}`,
          razorpayOrderId: response.razorpay_order_id || checkoutOrderId || "",
          razorpaySignature: response.razorpay_signature || "",
          mock,
        });
      },
      modal: {
        ondismiss: () => {
          reject(
            new Error(
              lastPaymentFailure ||
                "Payment was closed before completion. Use Razorpay test card or UPI success@razorpay."
            )
          );
        },
      },
    });

    checkout.on("payment.failed", (response) => {
      lastPaymentFailure =
        response?.error?.description ||
        "Razorpay test payment failed. Please retry with Razorpay test card or UPI success@razorpay.";
      console.warn("Razorpay test payment failed, waiting for retry:", response?.error || response);
    });

    checkout.open();
  });
}

function CheckoutScreen() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { currentUser, userProfile, logoutUser, saveUserProfileDetails } = useAuth();
  const {
    items,
    itemCount,
    subtotal,
    appliedCoupon,
    appliedCouponCode,
    discountAmount,
    clearCart,
  } = useCart();
  const [errors, setErrors] = useState({});
  const [placedOrderData, setPlacedOrderData] = useState(null);
  const [successNotice, setSuccessNotice] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [placingOrder, setPlacingOrder] = useState(false);
  const [orderHistory, setOrderHistory] = useState([]);
  const [form, setForm] = useState(() => ({
    fullName: userProfile?.name || userProfile?.firstName || currentUser?.displayName || "",
    mobileNumber: userProfile?.phoneNumber || "",
    alternateMobileNumber: userProfile?.alternatePhoneNumber || "",
    addressLine1: userProfile?.addressLine1 || "",
    addressLine2: userProfile?.addressLine2 || "",
    city: userProfile?.city || "",
    state: userProfile?.state || "",
    pincode: userProfile?.pincode || "",
    deliveryInstructions: userProfile?.deliveryInstructions || "",
  }));
  const deliveryCharge = 0;
  const total = Math.max(0, subtotal + deliveryCharge - discountAmount);
  const summaryItems = useMemo(() => items, [items]);
  const requestedOrderId = searchParams.get("order") || "";
  const hasFreshPlacementFlag = searchParams.get("placed") === "1";

  useEffect(() => {
    const unsubscribe = subscribeToUserOrders(
      currentUser?.uid,
      setOrderHistory,
      (error) => console.error("Failed to load checkout order history:", error)
    );

    return () => unsubscribe();
  }, [currentUser?.uid]);

  useEffect(() => {
    setForm((current) => ({
      fullName: current.fullName || userProfile?.name || userProfile?.firstName || currentUser?.displayName || "",
      mobileNumber: current.mobileNumber || userProfile?.phoneNumber || "",
      alternateMobileNumber: current.alternateMobileNumber || userProfile?.alternatePhoneNumber || "",
      addressLine1: current.addressLine1 || userProfile?.addressLine1 || "",
      addressLine2: current.addressLine2 || userProfile?.addressLine2 || "",
      city: current.city || userProfile?.city || "",
      state: current.state || userProfile?.state || "",
      pincode: current.pincode || userProfile?.pincode || "",
      deliveryInstructions: current.deliveryInstructions || userProfile?.deliveryInstructions || "",
    }));
  }, [currentUser?.displayName, userProfile]);

  useEffect(() => {
    if (!successNotice) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      setSuccessNotice("");
    }, 3200);

    return () => window.clearTimeout(timer);
  }, [successNotice]);

  useEffect(() => {
    if (!hasFreshPlacementFlag || !requestedOrderId) {
      return undefined;
    }

    setSuccessNotice("Order placed successfully.");

    const timer = window.setTimeout(() => {
      setSearchParams({ order: requestedOrderId }, { replace: true });
    }, 3200);

    return () => window.clearTimeout(timer);
  }, [hasFreshPlacementFlag, requestedOrderId, setSearchParams]);

  const handleLogout = async () => {
    await logoutUser();
    navigate("/", { replace: true });
  };

  const handleChange = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: "" }));
    setSubmitError("");
  };

  const validateForm = () => {
    const nextErrors = {};

    if (!form.fullName.trim()) {
      nextErrors.fullName = "Full name is required.";
    }

    if (!/^\d{10}$/.test(form.mobileNumber.trim())) {
      nextErrors.mobileNumber = "Enter a valid 10-digit mobile number.";
    }

    if (form.alternateMobileNumber.trim() && !/^\d{10}$/.test(form.alternateMobileNumber.trim())) {
      nextErrors.alternateMobileNumber = "Alternate number must be 10 digits.";
    }

    if (!form.addressLine1.trim()) {
      nextErrors.addressLine1 = "Delivery address line 1 is required.";
    }

    if (!form.city.trim()) {
      nextErrors.city = "City is required.";
    }

    if (!form.state.trim()) {
      nextErrors.state = "State is required.";
    }

    if (!/^\d{6}$/.test(form.pincode.trim())) {
      nextErrors.pincode = "Enter a valid 6-digit pincode.";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handlePlaceOrder = async (event) => {
    event.preventDefault();

    if (!validateForm()) {
      return;
    }

    if (!currentUser?.uid) {
      setSubmitError("Please log in again before placing your order.");
      return;
    }

    if (items.length === 0) {
      setSubmitError("Your cart is empty. Add products before placing an order.");
      return;
    }

    try {
      setPlacingOrder(true);
      setSubmitError("");

      let savedProfile = userProfile;

      try {
        savedProfile = await saveUserProfileDetails(form);
      } catch (profileError) {
        console.warn("Profile details could not be saved before placing order:", profileError);
      }

      const customer = {
        fullName: form.fullName.trim(),
        email: savedProfile?.email || currentUser.email || "",
        mobileNumber: form.mobileNumber.trim(),
        alternateMobileNumber: form.alternateMobileNumber.trim(),
        addressLine1: form.addressLine1.trim(),
        addressLine2: form.addressLine2.trim(),
        city: form.city.trim(),
        state: form.state.trim(),
        pincode: form.pincode.trim(),
        deliveryInstructions: form.deliveryInstructions.trim(),
      };
      const orderedItems = items.map((item) => ({
        key: item.key,
        id: item.id,
        name: item.name,
        image: item.image,
        price: item.price,
        unit: item.unit,
        size: item.size,
        quantity: item.quantity,
      }));

      const orderRef = doc(collection(db, "users", currentUser.uid, "orders"));
      const serverOrder = await createRazorpayOrderOnServer({
        user: currentUser,
        amount: total,
        customer,
        orderDocumentId: orderRef.id,
      });
      const paymentResult = await openRazorpayTestCheckout({
        amount: total,
        customer,
        orderId: orderRef.id,
        keyId: serverOrder.keyId,
        razorpayOrderId: serverOrder.razorpayOrderId,
        mock: serverOrder.mock,
      });
      const verifiedPayment = await verifyRazorpayPaymentOnServer(currentUser, {
        ...paymentResult,
        orderDocumentId: orderRef.id,
        mock: serverOrder.mock,
      });

      if (!verifiedPayment.verified) {
        throw new Error("Payment verification failed. Your order was not placed.");
      }

      const orderPayload = {
        userId: currentUser.uid,
        customer,
        items: orderedItems,
        itemCount,
        subtotal,
        discountAmount,
        couponCode: appliedCouponCode,
        coupon: appliedCoupon
          ? {
              id: appliedCoupon.id,
              code: appliedCoupon.code,
              type: appliedCoupon.type,
              discountValue: appliedCoupon.discountValue,
              discountAmount,
            }
          : null,
        deliveryCharge,
        total,
        paymentMethod: serverOrder.mock ? "Razorpay Mock Test" : "Razorpay Test",
        paymentStatus: "Paid",
        paymentProvider: "Razorpay",
        paymentMode: serverOrder.mock ? "mock-test" : "test",
        paymentId: verifiedPayment.paymentId || paymentResult.paymentId,
        razorpayOrderId: verifiedPayment.razorpayOrderId || paymentResult.razorpayOrderId,
        razorpaySignature: verifiedPayment.razorpaySignature || paymentResult.razorpaySignature,
        paidAt: serverTimestamp(),
        ...buildCheckoutOrderStatusPayload(),
        createdAt: serverTimestamp(),
      };

      await setDoc(orderRef, orderPayload);

      try {
        await createAdminOrderNotification({
          id: orderRef.id,
          ...orderPayload,
        });
      } catch (notificationError) {
        console.error("Failed to create admin order notification:", notificationError);
      }

      try {
        await apiRequest("/orders/inventory-adjustment", {
          user: currentUser,
          method: "POST",
          body: JSON.stringify({ items: orderedItems }),
        });
      } catch (inventoryError) {
        console.warn("Inventory adjustment failed after order placement:", inventoryError);
      }

      markCouponUsed(appliedCoupon?.id).catch((couponError) => {
        console.error("Failed to update coupon usage:", couponError);
      });
      const optimisticOrder = createOptimisticOrder(orderRef.id, orderPayload);

      setPlacedOrderData(optimisticOrder);
      setSuccessNotice("Payment completed. Order placed successfully.");
      showSiteToast("Payment completed. Order placed successfully.");
      clearCart();
      setSearchParams({ order: orderRef.id, placed: "1" }, { replace: true });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      console.error("Failed to place order:", error);
      setSubmitError(error.message || "We could not complete the payment right now. Please try again.");
    } finally {
      setPlacingOrder(false);
    }
  };

  const activeOrder = useMemo(() => {
    if (requestedOrderId) {
      return (
        orderHistory.find((item) => item.id === requestedOrderId || item.orderId === requestedOrderId) ||
        (placedOrderData?.id === requestedOrderId ? placedOrderData : null)
      );
    }

    return placedOrderData;
  }, [orderHistory, placedOrderData, requestedOrderId]);

  const visibleOrderHistory = useMemo(
    () => mergeOrdersWithCurrent(activeOrder, orderHistory),
    [activeOrder, orderHistory]
  );
  const shouldShowSuccessState = Boolean(activeOrder && items.length === 0 && (hasFreshPlacementFlag || placedOrderData));

  return (
    <div className="catalog-shell cart-shell">
      <div className="catalog-noise" aria-hidden="true" />

      <Navbar activeSection="products" onLogout={handleLogout} />

      <main className="catalog-page checkout-page">
        {shouldShowSuccessState ? (
          <section style={styles.successLayout}>
            <div className="checkout-success-actions" style={styles.successActions}>
              <Link to="/" className="catalog-button">
                Back to Home
              </Link>
              <Link to="/account" className="catalog-button catalog-button-secondary-alt">
                Open Account
              </Link>
            </div>

            <OrderHistoryPanel
              orders={visibleOrderHistory}
              title="Previous Orders"
              subtitle="Your newest order stays at the top, and all previous orders remain available here."
              highlightOrderId={activeOrder.id}
            />
          </section>
        ) : items.length === 0 ? (
          <section style={styles.emptyLayout}>
            <section className="catalog-empty cart-empty ember-surface">
              <h2>Your cart is empty.</h2>
              <p>Add products before moving to checkout, or review your order history below.</p>
              <div style={styles.emptyActions}>
                <Link to="/products" className="catalog-button">
                  Browse Products
                </Link>
                <Link to="/" className="catalog-button catalog-button-secondary-alt">
                  Back to Home
                </Link>
              </div>
            </section>

            <OrderHistoryPanel
              orders={orderHistory}
              title="Order History"
              subtitle="All orders placed from this account are saved automatically."
            />
          </section>
        ) : (
          <section className="checkout-active-layout">
            <section className="checkout-layout">
              <aside className="checkout-summary-panel ember-surface">
                <div className="cart-panel-head">
                  <div>
                    <span className="checkout-section-kicker">Order Summary</span>
                    <h2>Review totals</h2>
                  </div>
                  <span className="checkout-status-pill">{itemCount} items</span>
                </div>

                <div className="checkout-summary-list">
                  {summaryItems.map((item) => (
                    <div key={item.key} className="checkout-summary-item">
                      <div>
                        <strong>{item.name}</strong>
                        <span>{item.quantity} x {formatPrice(item.price)}</span>
                      </div>
                      <strong>{formatPrice(item.price * item.quantity)}</strong>
                    </div>
                  ))}
                </div>

                <div className="cart-summary-lines">
                  <div>
                    <span>Subtotal</span>
                    <strong>{formatPrice(subtotal)}</strong>
                  </div>
                  {appliedCoupon ? (
                    <div>
                      <span>{`Coupon (${appliedCoupon.code})`}</span>
                      <strong>-{formatPrice(discountAmount)}</strong>
                    </div>
                  ) : null}
                  <div>
                    <span>Delivery Charges</span>
                    <strong>{deliveryCharge === 0 ? "Free" : formatPrice(deliveryCharge)}</strong>
                  </div>
                  <div className="cart-total-line">
                    <span>Total Amount</span>
                    <strong>{formatPrice(total)}</strong>
                  </div>
                </div>

                <p className="checkout-side-note">
                  Your order is saved only after the Razorpay test payment is completed. Use Razorpay test card or UPI success@razorpay.
                </p>

                <div className="checkout-combined-section">
                  <div className="cart-panel-head">
                    <div>
                      <span className="checkout-section-kicker">Products</span>
                      <h2>Items in your cart</h2>
                    </div>
                  </div>

                  <div className="checkout-products-list">
                    {summaryItems.map((item) => (
                      <article key={item.key} className="checkout-product-card">
                        <div className="checkout-product-media">
                          <img src={item.image} alt={item.name} loading="eager" decoding="async" />
                        </div>
                        <div className="checkout-product-copy">
                          <strong>{item.name}</strong>
                          <span>{formatProductMeta(item) || "Standard pack"}</span>
                        </div>
                        <div className="checkout-product-total">
                          <span>Qty {item.quantity}</span>
                          <strong>{formatPrice(item.price * item.quantity)}</strong>
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              </aside>

              <form className="checkout-form-panel ember-surface" onSubmit={handlePlaceOrder}>
                <div className="cart-panel-head">
                  <div>
                    <span className="checkout-section-kicker">Delivery Details</span>
                    <h2>Shipping information</h2>
                  </div>
                </div>

                <div className="checkout-form-grid">
                  <label>
                    <span>Full Name</span>
                    <input
                      type="text"
                      value={form.fullName}
                      onChange={(event) => handleChange("fullName", event.target.value)}
                      placeholder="Full name"
                    />
                    {errors.fullName ? <small>{errors.fullName}</small> : null}
                  </label>

                  <label>
                    <span>Mobile Number</span>
                    <input
                      type="tel"
                      value={form.mobileNumber}
                      onChange={(event) => handleChange("mobileNumber", event.target.value)}
                      placeholder="10-digit mobile number"
                    />
                    {errors.mobileNumber ? <small>{errors.mobileNumber}</small> : null}
                  </label>

                  <label>
                    <span>Alternate Mobile Number</span>
                    <input
                      type="tel"
                      value={form.alternateMobileNumber}
                      onChange={(event) => handleChange("alternateMobileNumber", event.target.value)}
                      placeholder="Optional alternate number"
                    />
                    {errors.alternateMobileNumber ? <small>{errors.alternateMobileNumber}</small> : null}
                  </label>

                  <label className="checkout-field-full">
                    <span>Delivery Address Line 1</span>
                    <input
                      type="text"
                      value={form.addressLine1}
                      onChange={(event) => handleChange("addressLine1", event.target.value)}
                      placeholder="House, flat, street"
                    />
                    {errors.addressLine1 ? <small>{errors.addressLine1}</small> : null}
                  </label>

                  <label className="checkout-field-full">
                    <span>Delivery Address Line 2</span>
                    <input
                      type="text"
                      value={form.addressLine2}
                      onChange={(event) => handleChange("addressLine2", event.target.value)}
                      placeholder="Area, landmark"
                    />
                  </label>

                  <label>
                    <span>City</span>
                    <input
                      type="text"
                      value={form.city}
                      onChange={(event) => handleChange("city", event.target.value)}
                      placeholder="City"
                    />
                    {errors.city ? <small>{errors.city}</small> : null}
                  </label>

                  <label>
                    <span>State</span>
                    <input
                      type="text"
                      value={form.state}
                      onChange={(event) => handleChange("state", event.target.value)}
                      placeholder="State"
                    />
                    {errors.state ? <small>{errors.state}</small> : null}
                  </label>

                  <label>
                    <span>Pincode</span>
                    <input
                      type="text"
                      value={form.pincode}
                      onChange={(event) => handleChange("pincode", event.target.value)}
                      placeholder="6-digit pincode"
                    />
                    {errors.pincode ? <small>{errors.pincode}</small> : null}
                  </label>

                  <label className="checkout-field-full">
                    <span>Delivery Instructions</span>
                    <textarea
                      rows="4"
                      value={form.deliveryInstructions}
                      onChange={(event) => handleChange("deliveryInstructions", event.target.value)}
                      placeholder="Optional instructions for delivery"
                    />
                  </label>
                </div>

                {submitError ? <div className="auth-route-error">{submitError}</div> : null}

                <button type="submit" className="catalog-button cart-checkout-button" disabled={placingOrder}>
                  {placingOrder ? "Opening Razorpay..." : "Pay with Razorpay Test"}
                </button>
              </form>
            </section>

            {orderHistory.length > 0 ? (
              <OrderHistoryPanel
                orders={visibleOrderHistory}
                title="Previous Orders"
                subtitle="Your saved orders stay available here even while you build a new cart."
                highlightOrderId={activeOrder?.id || ""}
              />
            ) : null}
          </section>
        )}
      </main>

      {successNotice ? (
        <div style={styles.successToast} role="status" aria-live="polite">
          {successNotice}
        </div>
      ) : null}

      <Footer />
    </div>
  );
}

const styles = {
  successLayout: {
    display: "grid",
    gap: "24px",
  },
  emptyLayout: {
    display: "grid",
    gap: "24px",
  },
  emptyActions: {
    display: "flex",
    gap: "12px",
    justifyContent: "center",
    flexWrap: "wrap",
  },
  successActions: {
    display: "flex",
    gap: "12px",
    justifyContent: "center",
    flexWrap: "wrap",
  },
  successToast: {
    position: "fixed",
    right: "20px",
    bottom: "20px",
    zIndex: 50,
    padding: "12px 16px",
    borderRadius: "12px",
    background: "#16a34a",
    color: "#f0fdf4",
    boxShadow: "0 18px 48px rgba(22, 163, 74, 0.28)",
    fontWeight: 700,
  },
};

export default CheckoutScreen;
