import { useEffect, useMemo, useState } from "react";
import DataTable from "../components/DataTable";
import { PERIOD_OPTIONS, isWithinDateFilters } from "../utils/dateFilters";
import { exportRowsToExcel } from "../utils/exportExcel";
import {
  deleteReview,
  getReviewStatusOptions,
  subscribeToReviews,
  updateReviewStatus,
} from "../../lib/adminStore";

const Reviews = () => {
  const [reviews, setReviews] = useState([]);
  const [updatingReviewId, setUpdatingReviewId] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [period, setPeriod] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  useEffect(() => {
    const unsubscribe = subscribeToReviews(
      setReviews,
      (error) => console.error("Failed to load live reviews:", error)
    );

    return () => unsubscribe();
  }, []);

  const handleUpdateStatus = async (reviewId, status) => {
    try {
      setUpdatingReviewId(reviewId);
      await updateReviewStatus(reviewId, status);
    } catch (error) {
      console.error("Failed to update review status:", error);
    } finally {
      setUpdatingReviewId("");
    }
  };

  const handleDeleteReview = async (review) => {
    const confirmed = window.confirm(`Delete review from ${review.customer}?`);

    if (!confirmed) {
      return;
    }

    try {
      setUpdatingReviewId(review.id);
      await deleteReview(review.id);
    } catch (error) {
      console.error("Failed to delete review:", error);
    } finally {
      setUpdatingReviewId("");
    }
  };

  const filteredReviews = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return reviews.filter((item) => {
      const matchesDate = isWithinDateFilters(item.createdAt, period, fromDate, toDate);
      const matchesStatus = statusFilter === "All" || item.status === statusFilter;
      const matchesQuery =
        !normalizedQuery ||
        [
          item.product,
          item.customer,
          item.rating,
          item.status,
          item.date,
          "approve",
          "hide",
          "delete",
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(normalizedQuery));

      return matchesDate && matchesStatus && matchesQuery;
    });
  }, [fromDate, period, query, reviews, statusFilter, toDate]);

  const handleExport = () => {
    exportRowsToExcel({
      title: "Spice Root Reviews",
      fileName: "spice-root-reviews",
      columns: [
        { key: "product", label: "Product" },
        { key: "customer", label: "Customer" },
        { key: "type", label: "Type" },
        { key: "rating", label: "Rating" },
        { key: "review", label: "Review" },
        { key: "status", label: "Status" },
        { key: "date", label: "Date" },
      ],
      rows: filteredReviews,
    });
  };

  const columns = useMemo(
    () => [
      { key: "product", label: "Product" },
      { key: "customer", label: "Customer" },
      { key: "type", label: "Type" },
      { key: "rating", label: "Rating", render: (row) => <span className="admin-rating">{row.rating} / 5</span> },
      { key: "review", label: "Review" },
      { key: "status", label: "Status", type: "status" },
      { key: "date", label: "Date" },
      {
        key: "actions",
        label: "Actions",
        render: (row) => (
          <div style={styles.actions}>
            <button
              type="button"
              style={styles.approveButton}
              disabled={updatingReviewId === row.id || row.status === "Approved"}
              onClick={() => handleUpdateStatus(row.id, "Approved")}
            >
              {updatingReviewId === row.id ? "Saving..." : "Approve"}
            </button>
            <button
              type="button"
              style={styles.hideButton}
              disabled={updatingReviewId === row.id || row.status === "Hidden"}
              onClick={() => handleUpdateStatus(row.id, "Hidden")}
            >
              Hide
            </button>
            <button
              type="button"
              style={styles.deleteButton}
              disabled={updatingReviewId === row.id}
              onClick={() => handleDeleteReview(row)}
            >
              Delete
            </button>
          </div>
        ),
      },
    ],
    [updatingReviewId]
  );

  return (
    <section className="admin-module-section">
      <div className="admin-page-head">
        <div>
          <h2>Reviews</h2>
          <p>Live customer product and overall store reviews from delivered orders.</p>
        </div>
        <div className="admin-page-actions">
          <button type="button" className="admin-primary-button" onClick={handleExport}>
            Export Reviews Excel
          </button>
        </div>
      </div>

      <div className="admin-module-card admin-export-section">
        <div className="admin-page-head compact">
          <div>
            <h3>Review Filters</h3>
            <p>Filter by calendar date, product name, customer, rating, status, date, or action.</p>
          </div>
          <button type="button" className="admin-secondary-button" onClick={handleExport}>
            Download This Section
          </button>
        </div>
        <div className="admin-filter-row">
          <input
            className="admin-inline-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search product, customer, rating, status, date, action..."
          />
          <select className="admin-inline-search" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            {["All", ...getReviewStatusOptions()].map((item) => (
              <option key={item} value={item}>{item === "All" ? "All Statuses" : item}</option>
            ))}
          </select>
          <select className="admin-inline-search" value={period} onChange={(event) => setPeriod(event.target.value)}>
            {PERIOD_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <input className="admin-inline-search" type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
          <input className="admin-inline-search" type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
        </div>
      </div>

      <div className="admin-module-card">
        <DataTable columns={columns} rows={filteredReviews} rowKey="id" />
        {filteredReviews.length === 0 ? (
          <div className="admin-empty-state" style={styles.emptyState}>
            No reviews match the selected filters.
          </div>
        ) : null}
      </div>
    </section>
  );
};

const styles = {
  actions: {
    display: "flex",
    gap: "10px",
    flexWrap: "wrap",
  },
  approveButton: {
    background: "transparent",
    border: 0,
    color: "#86efac",
    cursor: "pointer",
    padding: 0,
  },
  hideButton: {
    background: "transparent",
    border: 0,
    color: "#fca5a5",
    cursor: "pointer",
    padding: 0,
  },
  deleteButton: {
    background: "transparent",
    border: 0,
    color: "#f87171",
    cursor: "pointer",
    padding: 0,
  },
  emptyState: {
    marginTop: "12px",
  },
};

export default Reviews;
