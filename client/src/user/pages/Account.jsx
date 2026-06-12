import { useEffect, useMemo, useState } from "react";
import { downloadInvoicePdf } from "../../lib/invoicePdf";
import { FaBell } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import Footer from "../../components/Footer";
import { useAuth } from "../../context/useAuth";
import {
  getReviewableDeliveredItems,
  markContactReplyAsSeen,
  submitReview,
  subscribeToUserContactSubmissions,
  subscribeToReviewsForUser,
} from "../../lib/adminStore";
import { subscribeToUserOrders } from "../../lib/userOrders";
import OrderHistoryPanel from "../components/OrderHistoryPanel";
import "../../styles/auth-pages.css";
import "../../styles/luxury-spice.css";
import "../../styles/navbar-final.css";

function Account() {
  const navigate = useNavigate();
  const { currentUser, emailVerified, reloadAuthUser, resendVerificationEmail, userProfile, logoutUser } =
    useAuth();
  const [verificationMessage, setVerificationMessage] = useState("");
  const [verificationLoading, setVerificationLoading] = useState(false);
  const [orders, setOrders] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [contactReplies, setContactReplies] = useState([]);
  const [reviewDrafts, setReviewDrafts] = useState({});
  const [reviewFeedback, setReviewFeedback] = useState({ type: "", message: "" });
  const [submittingReviewKey, setSubmittingReviewKey] = useState("");
  const [replyPopupOpen, setReplyPopupOpen] = useState(false);

  const displayName = userProfile?.name || currentUser?.displayName || "Spice Root member";
  const displayEmail = userProfile?.email || currentUser?.email || "No email available";

  useEffect(() => {
    const unsubscribe = subscribeToUserOrders(
      currentUser?.uid,
      setOrders,
      (error) => console.error("Failed to load account order history:", error)
    );

    return () => unsubscribe();
  }, [currentUser?.uid]);

  useEffect(() => {
    const unsubscribe = subscribeToReviewsForUser(
      currentUser?.uid || "",
      setReviews,
      (error) => console.error("Failed to load account reviews:", error)
    );

    return () => unsubscribe();
  }, [currentUser?.uid]);

  useEffect(() => {
    const unsubscribe = subscribeToUserContactSubmissions(
      currentUser?.uid || "",
      userProfile?.email || currentUser?.email || "",
      setContactReplies,
      (error) => console.error("Failed to load account contact replies:", error)
    );

    return () => unsubscribe();
  }, [currentUser?.email, currentUser?.uid, userProfile?.email]);

  const reviewableItems = useMemo(() => getReviewableDeliveredItems(orders), [orders]);
  const latestDeliveredOrderId = reviewableItems[0]?.orderId || "";
  const overallReview = reviews.find((item) => item.type === "overall") || null;
  const unreadReplies = useMemo(
    () => contactReplies.filter((item) => !item.userReplySeen && item.adminReply),
    [contactReplies]
  );
  const productReviewsByKey = useMemo(
    () =>
      new Map(
        reviews
          .filter((item) => item.type === "product")
          .map((item) => [`${item.orderId}::${item.productId}`, item])
      ),
    [reviews]
  );

  const handleLogout = async () => {
    await logoutUser();
    navigate("/", { replace: true });
  };

  const handleResendVerification = async () => {
    try {
      setVerificationLoading(true);
      setVerificationMessage("");
      await resendVerificationEmail();
      setVerificationMessage("Verification email sent. Check your inbox.");
    } catch (error) {
      console.error("Failed to resend verification email:", error);
      setVerificationMessage("Could not send the verification email right now.");
    } finally {
      setVerificationLoading(false);
    }
  };

  const handleRefreshVerification = async () => {
    try {
      setVerificationLoading(true);
      setVerificationMessage("");
      const user = await reloadAuthUser();
      setVerificationMessage(
        user?.emailVerified
          ? "Your email is now verified."
          : "Your email is still unverified. Check your inbox for the verification link."
      );
    } catch (error) {
      console.error("Failed to refresh verification status:", error);
      setVerificationMessage("Could not refresh your verification status.");
    } finally {
      setVerificationLoading(false);
    }
  };

  const handleReviewDraftChange = (key, field, value) => {
    setReviewDrafts((current) => ({
      ...current,
      [key]: {
        rating: 5,
        review: "",
        ...current[key],
        [field]: field === "rating" ? Number(value) : value,
      },
    }));
    setReviewFeedback({ type: "", message: "" });
  };

  const handleSubmitReview = async ({
    key,
    type,
    orderId = "",
    productId = "",
    productName = "",
  }) => {
    const draft = reviewDrafts[key] || { rating: 5, review: "" };
    const review = draft.review.trim();

    if (!review) {
      setReviewFeedback({ type: "error", message: "Please write a short review before submitting." });
      return;
    }

    if (!currentUser?.uid) {
      setReviewFeedback({ type: "error", message: "Please log in again before sending a review." });
      return;
    }

    try {
      setSubmittingReviewKey(key);
      setReviewFeedback({ type: "", message: "" });

      await submitReview({
        userId: currentUser.uid,
        customerName: displayName,
        customerEmail: displayEmail,
        orderId: type === "overall" ? latestDeliveredOrderId : orderId,
        productId,
        productName,
        type,
        rating: draft.rating,
        review,
      });

      setReviewDrafts((current) => ({
        ...current,
        [key]: { rating: 5, review: "" },
      }));
      setReviewFeedback({
        type: "success",
        message: "Your review was saved and sent to the admin review queue.",
      });
    } catch (error) {
      console.error("Failed to submit review:", error);
      setReviewFeedback({
        type: "error",
        message: "We could not submit your review right now. Please try again.",
      });
    } finally {
      setSubmittingReviewKey("");
    }
  };

  const handleOpenReplyPopup = async () => {
    setReplyPopupOpen(true);

    await Promise.all(
      unreadReplies.map((item) =>
        markContactReplyAsSeen(item.id).catch((error) => {
          console.error("Failed to mark contact reply as seen:", error);
        })
      )
    );
  };

  return (
    <div className="auth-route-shell" style={styles.shell}>
      <div className="auth-route-card" style={styles.card}>
        <div className="auth-route-head">
          <span>Account</span>
          <h1>Welcome, {displayName}</h1>
          <p>Your profile, session details, and order history are all available here.</p>
        </div>

        {unreadReplies.length > 0 ? (
          <button type="button" style={styles.replyBell} onClick={handleOpenReplyPopup} aria-label="Open admin replies">
            <FaBell />
            <span style={styles.replyBellCount}>{unreadReplies.length}</span>
          </button>
        ) : null}

        <div className="auth-route-form">
          <div className="auth-field">
            <label>Name</label>
            <input type="text" value={displayName} readOnly />
          </div>

          <div className="auth-field">
            <label>Email</label>
            <input type="email" value={displayEmail} readOnly />
          </div>

          <div className="auth-field">
            <label>Session status</label>
            <input
              type="text"
              value={emailVerified ? "Authenticated and verified" : "Authenticated (email not verified)"}
              readOnly
            />
          </div>

          {!emailVerified ? (
            <div className="auth-route-actions">
              <button
                type="button"
                className="auth-secondary-button"
                onClick={handleResendVerification}
                disabled={verificationLoading}
              >
                {verificationLoading ? "Sending..." : "Resend verification email"}
              </button>
              <button
                type="button"
                className="auth-secondary-button"
                onClick={handleRefreshVerification}
                disabled={verificationLoading}
              >
                I verified my email
              </button>
            </div>
          ) : null}

          {verificationMessage ? <div className="auth-route-message">{verificationMessage}</div> : null}

          <button type="button" className="auth-secondary-button" onClick={handleLogout}>
            Sign out
          </button>
        </div>
      </div>

      <section className="auth-route-card" style={styles.card}>
        <div className="auth-route-head">
          <span>Reviews</span>
          <h2 style={styles.sectionTitle}>Review delivered orders</h2>
          <p>Product and overall store reviews can be submitted only after delivery.</p>
        </div>

        {reviewFeedback.message ? (
          <div
            className="auth-route-error"
            style={reviewFeedback.type === "success" ? styles.successBanner : undefined}
          >
            {reviewFeedback.message}
          </div>
        ) : null}

        {reviewableItems.length === 0 ? (
          <div style={styles.reviewEmpty}>
            Delivered products will appear here automatically when an order reaches the delivered stage.
          </div>
        ) : (
          <div style={styles.reviewLayout}>
            <article style={styles.reviewCard}>
              <div style={styles.reviewCardHead}>
                <div>
                  <strong>Overall Store Review</strong>
                  <p style={styles.reviewCopy}>
                    Share your feedback about the overall Spice Root experience.
                  </p>
                </div>
                {overallReview ? (
                  <span style={styles.reviewStatus(overallReview.status)}>
                    {overallReview.status}
                  </span>
                ) : null}
              </div>

              {overallReview ? (
                <div style={styles.reviewSummary}>
                  <strong>{overallReview.rating} / 5</strong>
                  <p>{overallReview.review}</p>
                </div>
              ) : (
                <>
                  <label style={styles.reviewField}>
                    <span>Rating</span>
                    <select
                      value={reviewDrafts.overall?.rating || 5}
                      onChange={(event) =>
                        handleReviewDraftChange("overall", "rating", event.target.value)
                      }
                    >
                      {[5, 4, 3, 2, 1].map((value) => (
                        <option key={value} value={value}>
                          {value} / 5
                        </option>
                      ))}
                    </select>
                  </label>

                  <label style={styles.reviewField}>
                    <span>Your review</span>
                    <textarea
                      rows="4"
                      value={reviewDrafts.overall?.review || ""}
                      onChange={(event) =>
                        handleReviewDraftChange("overall", "review", event.target.value)
                      }
                      placeholder="Tell us about product quality, delivery, and your overall experience."
                    />
                  </label>

                  <button
                    type="button"
                    className="auth-secondary-button"
                    disabled={submittingReviewKey === "overall"}
                    onClick={() =>
                      handleSubmitReview({
                        key: "overall",
                        type: "overall",
                        productName: "Overall Store Review",
                      })
                    }
                  >
                    {submittingReviewKey === "overall" ? "Submitting..." : "Submit Overall Review"}
                  </button>
                </>
              )}
            </article>

            {reviewableItems.map((item) => {
              const reviewKey = `${item.orderId}::${item.productId}`;
              const existingReview = productReviewsByKey.get(reviewKey);

              return (
                <article key={reviewKey} style={styles.reviewCard}>
                  <div style={styles.reviewCardHead}>
                    <div>
                      <strong>{item.productName}</strong>
                      <p style={styles.reviewCopy}>
                        Order {item.orderId} • Qty {item.quantity}
                      </p>
                    </div>
                    {existingReview ? (
                      <span style={styles.reviewStatus(existingReview.status)}>
                        {existingReview.status}
                      </span>
                    ) : null}
                  </div>

                  {existingReview ? (
                    <div style={styles.reviewSummary}>
                      <strong>{existingReview.rating} / 5</strong>
                      <p>{existingReview.review}</p>
                    </div>
                  ) : (
                    <>
                      <label style={styles.reviewField}>
                        <span>Rating</span>
                        <select
                          value={reviewDrafts[reviewKey]?.rating || 5}
                          onChange={(event) =>
                            handleReviewDraftChange(reviewKey, "rating", event.target.value)
                          }
                        >
                          {[5, 4, 3, 2, 1].map((value) => (
                            <option key={value} value={value}>
                              {value} / 5
                            </option>
                          ))}
                        </select>
                      </label>

                      <label style={styles.reviewField}>
                        <span>Your review</span>
                        <textarea
                          rows="4"
                          value={reviewDrafts[reviewKey]?.review || ""}
                          onChange={(event) =>
                            handleReviewDraftChange(reviewKey, "review", event.target.value)
                          }
                          placeholder="Share product-specific feedback after delivery."
                        />
                      </label>

                      <button
                        type="button"
                        className="auth-secondary-button"
                        disabled={submittingReviewKey === reviewKey}
                        onClick={() =>
                          handleSubmitReview({
                            key: reviewKey,
                            type: "product",
                            orderId: item.orderId,
                            productId: item.productId,
                            productName: item.productName,
                          })
                        }
                      >
                        {submittingReviewKey === reviewKey ? "Submitting..." : "Submit Product Review"}
                      </button>
                    </>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>

      <OrderHistoryPanel
        orders={orders}
        title="Your Order History"
        subtitle="Every order placed from your account is saved automatically."
        emptyTitle="No orders placed yet."
        emptyBody="Start shopping to build your order history."
        onDownloadInvoice={downloadInvoicePdf}
      />

      {replyPopupOpen ? (
        <div style={styles.replyOverlay} role="dialog" aria-modal="true">
          <div style={styles.replyPopup}>
            <div style={styles.replyPopupHead}>
              <div>
                <strong>Admin Replies</strong>
                <p style={styles.replyPopupCopy}>New responses to your contact messages.</p>
              </div>
              <button type="button" className="auth-secondary-button" onClick={() => setReplyPopupOpen(false)}>
                Close
              </button>
            </div>

            <div style={styles.replyList}>
              {contactReplies
                .filter((item) => item.adminReply)
                .map((item) => (
                  <article key={item.id} style={styles.replyCard}>
                    <strong>{item.subject}</strong>
                    <span style={styles.replyMeta}>{item.dateTime}</span>
                    <p style={styles.replyMessage}>{item.adminReply}</p>
                  </article>
                ))}
            </div>
          </div>
        </div>
      ) : null}

      <Footer />
    </div>
  );
}

const styles = {
  shell: {
    maxWidth: "1160px",
    margin: "0 auto",
    display: "grid",
    gap: "24px",
    padding: "48px 20px 80px",
  },
  card: {
    width: "100%",
    maxWidth: "100%",
    position: "relative",
  },
  sectionTitle: {
    margin: 0,
  },
  replyBell: {
    position: "absolute",
    top: "24px",
    right: "24px",
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    padding: "10px 14px",
    borderRadius: "999px",
    border: "1px solid rgba(247, 164, 0, 0.24)",
    background: "rgba(247, 164, 0, 0.12)",
    color: "#ffe1a8",
    cursor: "pointer",
    fontWeight: 700,
  },
  replyBellCount: {
    minWidth: "22px",
    height: "22px",
    display: "inline-grid",
    placeItems: "center",
    borderRadius: "999px",
    background: "#f7a400",
    color: "#2a1802",
    fontSize: "0.8rem",
  },
  reviewEmpty: {
    padding: "16px",
    borderRadius: "16px",
    background: "rgba(255,255,255,0.04)",
    color: "rgba(255,255,255,0.74)",
    lineHeight: 1.6,
  },
  reviewLayout: {
    display: "grid",
    gap: "16px",
  },
  reviewCard: {
    display: "grid",
    gap: "14px",
    padding: "18px",
    borderRadius: "18px",
    background: "rgba(255,255,255,0.04)",
  },
  reviewCardHead: {
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    alignItems: "flex-start",
  },
  reviewCopy: {
    margin: "6px 0 0",
    color: "rgba(255,255,255,0.66)",
    lineHeight: 1.5,
  },
  reviewField: {
    display: "grid",
    gap: "8px",
  },
  reviewSummary: {
    display: "grid",
    gap: "8px",
    color: "rgba(255,255,255,0.82)",
    lineHeight: 1.6,
  },
  successBanner: {
    background: "rgba(34, 197, 94, 0.12)",
    borderColor: "rgba(34, 197, 94, 0.24)",
    color: "#bbf7d0",
  },
  replyOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(9, 7, 5, 0.78)",
    display: "grid",
    placeItems: "center",
    padding: "20px",
    zIndex: 60,
  },
  replyPopup: {
    width: "min(720px, 100%)",
    maxHeight: "80vh",
    overflow: "auto",
    borderRadius: "24px",
    padding: "24px",
    background: "#1f1610",
    border: "1px solid rgba(255,255,255,0.08)",
    display: "grid",
    gap: "18px",
  },
  replyPopupHead: {
    display: "flex",
    justifyContent: "space-between",
    gap: "16px",
    alignItems: "flex-start",
  },
  replyPopupCopy: {
    margin: "6px 0 0",
    color: "rgba(255,255,255,0.68)",
  },
  replyList: {
    display: "grid",
    gap: "14px",
  },
  replyCard: {
    display: "grid",
    gap: "8px",
    padding: "16px",
    borderRadius: "16px",
    background: "rgba(255,255,255,0.04)",
  },
  replyMeta: {
    color: "rgba(255,255,255,0.62)",
    fontSize: "0.88rem",
  },
  replyMessage: {
    margin: 0,
    lineHeight: 1.6,
    color: "rgba(255,255,255,0.82)",
  },
  reviewStatus: (status) => ({
    display: "inline-flex",
    alignItems: "center",
    padding: "5px 10px",
    borderRadius: "999px",
    background:
      status === "Approved"
        ? "rgba(34, 197, 94, 0.12)"
        : status === "Hidden"
          ? "rgba(239, 68, 68, 0.12)"
          : "rgba(245, 158, 11, 0.14)",
    color:
      status === "Approved"
        ? "#bbf7d0"
        : status === "Hidden"
          ? "#fca5a5"
          : "#fde68a",
    fontSize: "0.82rem",
    fontWeight: 600,
  }),
};

export default Account;
