import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/useAuth";
import { useCart } from "../../context/useCart";
import Footer from "../../components/Footer";
import { formatPrice, formatProductMeta } from "../../lib/catalog";
import { cancelUserOrder, subscribeToUserOrders } from "../../lib/userOrders";
import { showSiteToast } from "../../lib/siteToast";
import { downloadInvoicePdf } from "../../lib/invoicePdf";
import OrderHistoryPanel from "../components/OrderHistoryPanel";
import Navbar from "../components/Navbar";
import "../../styles/products-listing.css";
import "../../styles/luxury-spice.css";
import "../../styles/navbar-final.css";

function CartScreen() {
  const navigate = useNavigate();
  const { currentUser, logoutUser } = useAuth();
  const {
    items,
    itemCount,
    subtotal,
    appliedCoupon,
    appliedCouponCode,
    discountAmount,
    increaseQuantity,
    decreaseQuantity,
    removeItem,
    applyCoupon,
    removeCoupon,
  } = useCart();
  const [orders, setOrders] = useState([]);
  const [showOlderOrders, setShowOlderOrders] = useState(false);
  const [cancellingOrderId, setCancellingOrderId] = useState("");
  const [couponInput, setCouponInput] = useState("");
  const [couponMessage, setCouponMessage] = useState("");
  const deliveryCharge = 0;
  const total = Math.max(0, subtotal + deliveryCharge - discountAmount);
  const currentOrder = orders[0] || null;
  const olderOrders = useMemo(() => orders.slice(1), [orders]);

  useEffect(() => {
    const unsubscribe = subscribeToUserOrders(
      currentUser?.uid,
      setOrders,
      (error) => console.error("Failed to load cart order history:", error)
    );

    return () => unsubscribe();
  }, [currentUser?.uid]);

  const handleLogout = async () => {
    await logoutUser();
    navigate("/", { replace: true });
  };

  const handleApplyCoupon = (event) => {
    event.preventDefault();
    const result = applyCoupon(couponInput);
    setCouponMessage(result.message);

    if (result.success) {
      setCouponInput("");
    }
  };

  const handleCancelOrder = async (order) => {
    try {
      setCancellingOrderId(order.id);
      await cancelUserOrder(order);
      showSiteToast("Order cancelled successfully.");
    } catch (error) {
      console.error("Failed to cancel order:", error);
      showSiteToast(error.message || "This order cannot be cancelled now.", { type: "error" });
    } finally {
      setCancellingOrderId("");
    }
  };

  const renderOrderTracking = () => (
    <section className="cart-orders-area">
      <OrderHistoryPanel
        orders={currentOrder ? [currentOrder] : []}
        title="Current Order Tracking"
        subtitle="Your latest order stays visible here and updates live when admin changes its status."
        highlightOrderId={currentOrder?.id || ""}
        emptyTitle="No current order yet."
        emptyBody="Your newest confirmed order will appear here with live tracking."
        onCancelOrder={handleCancelOrder}
        onDownloadInvoice={downloadInvoicePdf}
        cancellingOrderId={cancellingOrderId}
      />

      <div className="cart-my-orders-row">
        <button
          type="button"
          className="catalog-button catalog-button-secondary-alt cart-my-orders-button"
          onClick={() => setShowOlderOrders((current) => !current)}
          disabled={olderOrders.length === 0}
        >
          {showOlderOrders ? "Hide My Orders" : `My Orders${olderOrders.length ? ` (${olderOrders.length})` : ""}`}
        </button>
      </div>

      {showOlderOrders ? (
        <OrderHistoryPanel
          orders={olderOrders}
          title="My Orders"
          subtitle="Older orders are hidden until you open them from this button."
          emptyTitle="No older orders yet."
          emptyBody="After you place more orders, previous ones will appear here."
          onCancelOrder={handleCancelOrder}
          onDownloadInvoice={downloadInvoicePdf}
          cancellingOrderId={cancellingOrderId}
        />
      ) : null}
    </section>
  );

  return (
    <div className="catalog-shell cart-shell">
      <div className="catalog-noise" aria-hidden="true" />

      <Navbar activeSection="products" onLogout={handleLogout} />

      <main className="catalog-page cart-page">
        <section className="catalog-hero cart-hero">
          <div className="catalog-title-line" />
          <p>Your cart</p>
          <h1>Review the spices you picked.</h1>
          <span>Update quantities, remove items, and continue when your order looks right.</span>
        </section>

        {items.length === 0 ? (
          <div style={styles.emptyLayout}>
            <section className="catalog-empty cart-empty ember-surface">
              <h2>Your cart is empty right now.</h2>
              <p>Add products from the catalog to see them here instantly.</p>
              <div style={styles.emptyActions}>
                <Link to="/products" className="catalog-button">
                  Add More Products
                </Link>
                <Link to="/" className="catalog-button catalog-button-secondary-alt">
                  Back to Home
                </Link>
              </div>
            </section>

            <OrderHistoryPanel
              orders={currentOrder ? [currentOrder] : []}
              title="Recent Orders"
              subtitle="Since your cart is empty, here are the orders already saved to your account."
              highlightOrderId={currentOrder?.id || ""}
              emptyTitle="No saved orders yet."
              emptyBody="Place an order and it will appear here automatically."
              onCancelOrder={handleCancelOrder}
              onDownloadInvoice={downloadInvoicePdf}
              cancellingOrderId={cancellingOrderId}
            />
            <div className="cart-my-orders-row">
              <button
                type="button"
                className="catalog-button catalog-button-secondary-alt cart-my-orders-button"
                onClick={() => setShowOlderOrders((current) => !current)}
                disabled={olderOrders.length === 0}
              >
                {showOlderOrders ? "Hide My Orders" : `My Orders${olderOrders.length ? ` (${olderOrders.length})` : ""}`}
              </button>
            </div>
            {showOlderOrders ? (
              <OrderHistoryPanel
                orders={olderOrders}
                title="My Orders"
                subtitle="Older orders are hidden until you open them from this button."
                emptyTitle="No older orders yet."
                emptyBody="After you place more orders, previous ones will appear here."
                onCancelOrder={handleCancelOrder}
                onDownloadInvoice={downloadInvoicePdf}
                cancellingOrderId={cancellingOrderId}
              />
            ) : null}
          </div>
        ) : (
          <>
            <section className="cart-layout">
              <div className="cart-items-panel ember-surface">
                <div className="cart-panel-head">
                  <div>
                    <span className="checkout-section-kicker">Cart Items</span>
                    <h2>Added products</h2>
                  </div>
                  <span className="checkout-status-pill">{itemCount} items</span>
                </div>

                <div className="cart-item-list">
                  {items.map((item) => {
                    const itemTotal = item.price * item.quantity;

                    return (
                      <article key={item.key} className="cart-item-card">
                        <div className="cart-item-media">
                          <img src={item.image} alt={item.name} loading="lazy" decoding="async" />
                        </div>

                        <div className="cart-item-copy">
                          <div className="cart-item-top">
                            <div>
                              <h3>{item.name}</h3>
                              <p>{formatProductMeta(item) || "Standard pack"}</p>
                            </div>
                            <strong>{formatPrice(itemTotal)}</strong>
                          </div>

                          <div className="cart-item-actions">
                            <div className="detail-quantity">
                              <button type="button" onClick={() => decreaseQuantity(item.key)}>
                                -
                              </button>
                              <span>{item.quantity}</span>
                              <button type="button" onClick={() => increaseQuantity(item.key)}>
                                +
                              </button>
                            </div>

                            <button
                              type="button"
                              className="catalog-text-button cart-remove-button"
                              onClick={() => removeItem(item.key)}
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>

              <aside className="cart-summary-panel ember-surface">
                <div className="cart-panel-head">
                  <div>
                    <span className="checkout-section-kicker">Order Summary</span>
                    <h2>Ready for checkout</h2>
                  </div>
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
                  Checkout saves your products and delivery details in Firestore.
                </p>

                <form className="cart-coupon-form" onSubmit={handleApplyCoupon}>
                  <label>
                    <span>Coupon Code</span>
                    <input
                      type="text"
                      value={couponInput}
                      onChange={(event) => {
                        setCouponInput(event.target.value.toUpperCase());
                        setCouponMessage("");
                      }}
                      placeholder={appliedCouponCode || "Enter coupon code"}
                    />
                  </label>
                  <button type="submit" className="catalog-button">
                    Apply
                  </button>
                </form>

                {appliedCoupon ? (
                  <button type="button" className="catalog-text-button cart-remove-button" onClick={removeCoupon}>
                    Remove {appliedCoupon.code}
                  </button>
                ) : null}

                {couponMessage ? <p className="checkout-side-note">{couponMessage}</p> : null}

                <button
                  type="button"
                  className="catalog-button cart-checkout-button"
                  onClick={() => navigate("/checkout")}
                >
                  Proceed to Checkout
                </button>

                <button
                  type="button"
                  className="catalog-button catalog-button-secondary-alt"
                  onClick={() => navigate("/products")}
                >
                  Add More Products
                </button>
              </aside>
            </section>

            {renderOrderTracking()}
          </>
        )}
      </main>

      <Footer />
    </div>
  );
}

const styles = {
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
};

export default CartScreen;
