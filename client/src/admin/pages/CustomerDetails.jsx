import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import ActionButton from "../components/ActionButton";
import StatusBadge from "../components/StatusBadge";
import {
  buildCustomerDetails,
  subscribeToOrders,
  subscribeToReviews,
  subscribeToUsers,
} from "../../lib/adminStore";

const CustomerDetails = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [users, setUsers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [reviews, setReviews] = useState([]);
  const selectedUserId = searchParams.get("user") || "";
  const selectedOrderId = searchParams.get("order") || "";

  useEffect(() => {
    const unsubscribe = subscribeToUsers(
      setUsers,
      (error) => console.error("Failed to load customer profile:", error)
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeToOrders(
      setOrders,
      (error) => console.error("Failed to load customer order history:", error)
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeToReviews(
      setReviews,
      (error) => console.error("Failed to load customer reviews:", error)
    );

    return () => unsubscribe();
  }, []);

  const customerProfile = useMemo(
    () => buildCustomerDetails(users, orders, reviews, selectedUserId),
    [orders, reviews, selectedUserId, users]
  );
  const selectedCustomerOrder = useMemo(() => {
    if (!customerProfile) {
      return null;
    }

    return (
      customerProfile.orders.find(
        (item) => item.id === selectedOrderId || item.orderId === selectedOrderId
      ) || customerProfile.orders[0] || null
    );
  }, [customerProfile, selectedOrderId]);

  if (!customerProfile) {
    return (
      <section className="admin-module-section">
        <div className="admin-empty-state">
          Select a customer from the Customers table or from the notification panel to view order details.
        </div>
      </section>
    );
  }

  return (
    <section className="admin-module-section">
      <div className="admin-page-head">
        <div>
          <h2>Customer Details</h2>
          <p>Review customer profile, order history, and product review activity from the live database.</p>
        </div>
      </div>

      <div className="admin-customer-detail-shell">
        <aside className="admin-profile-card">
          <div className="admin-profile-head">
            <div className="admin-avatar admin-avatar-large">
              {customerProfile.name.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <h3>{customerProfile.name}</h3>
              <p>{customerProfile.email}</p>
              <span>{customerProfile.phone}</span>
            </div>
          </div>

          <div className="admin-detail-grid">
            <div><span>Total Orders</span><strong>{customerProfile.totalOrders}</strong></div>
            <div><span>Total Spend</span><strong>{customerProfile.totalSpend}</strong></div>
            <div><span>Loyalty Points</span><strong>{customerProfile.loyaltyPoints}</strong></div>
            <div><span>Last Active</span><strong>{customerProfile.lastActive}</strong></div>
            <div className="full"><span>Favorite Product</span><strong>{customerProfile.favorite}</strong></div>
            <div className="full"><span>Address</span><strong>{customerProfile.address}</strong></div>
            <div className="full"><span>Notes</span><strong>{customerProfile.notes}</strong></div>
          </div>
        </aside>

        <div className="admin-module-card">
          <div className="admin-page-head compact">
            <div>
              <h3>Order History</h3>
              <p>Recent customer orders and the currently selected order details.</p>
            </div>
          </div>

          <div className="admin-mini-table">
            {customerProfile.orders.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`admin-mini-table-row admin-mini-table-button${item.id === selectedCustomerOrder?.id ? " active" : ""}`}
                onClick={() =>
                  navigate(
                    `/admin/customer-details?user=${encodeURIComponent(customerProfile.id)}&order=${encodeURIComponent(item.id)}`
                  )
                }
              >
                <div>
                  <strong>{item.orderId}</strong>
                  <span>{item.date}</span>
                </div>
                <span>{item.amountLabel}</span>
                <StatusBadge status={item.status} />
              </button>
            ))}
          </div>

          {selectedCustomerOrder ? (
            <>
              <div className="admin-page-head compact">
                <div>
                  <h3>Selected Order</h3>
                  <p>{selectedCustomerOrder.orderId}</p>
                </div>
                <StatusBadge status={selectedCustomerOrder.status} />
              </div>

              <div className="admin-detail-grid">
                <div><span>Payment</span><strong>{selectedCustomerOrder.paymentMethod}</strong></div>
                <div><span>Payment Status</span><strong>{selectedCustomerOrder.paymentStatus}</strong></div>
                <div><span>Items</span><strong>{selectedCustomerOrder.itemCount}</strong></div>
                <div><span>Phone</span><strong>{selectedCustomerOrder.phone}</strong></div>
                <div className="full"><span>Shipping Address</span><strong>{selectedCustomerOrder.address}</strong></div>
              </div>

              <div className="admin-mini-table" style={styles.itemList}>
                {selectedCustomerOrder.items.map((item) => (
                  <div key={item.key || `${item.id}-${item.size || "default"}`} className="admin-mini-table-row">
                    <div>
                      <strong>{item.name}</strong>
                      <span>{item.size || item.unit || "Standard pack"}</span>
                    </div>
                    <span>Qty {item.quantity}</span>
                    <span>{Number((item.price || 0) * (item.quantity || 0)).toLocaleString("en-IN", {
                      style: "currency",
                      currency: "INR",
                      maximumFractionDigits: 0,
                    })}</span>
                  </div>
                ))}
              </div>
            </>
          ) : null}

          <div className="admin-page-actions stretch">
            <ActionButton onClick={() => navigate(`/admin/orders?order=${encodeURIComponent(selectedCustomerOrder?.id || "")}&user=${encodeURIComponent(customerProfile.id)}`)}>
              Open In Orders
            </ActionButton>
            <ActionButton variant="primary" onClick={() => navigate("/admin/customers")}>
              Back To Customers
            </ActionButton>
          </div>
        </div>
      </div>
    </section>
  );
};

const styles = {
  itemList: {
    marginTop: "14px",
  },
};

export default CustomerDetails;
