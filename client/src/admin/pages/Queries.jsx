import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import DataTable from "../components/DataTable";
import {
  createUserQueryReplyNotification,
  markContactSubmissionAsRead,
  replyToContactSubmission,
  subscribeToContactSubmissions,
} from "../../lib/adminStore";

const Queries = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [queries, setQueries] = useState([]);
  const [selectedQueryId, setSelectedQueryId] = useState(searchParams.get("query") || "");
  const [replyDraft, setReplyDraft] = useState("");
  const [savingReply, setSavingReply] = useState(false);
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    const unsubscribe = subscribeToContactSubmissions(
      setQueries,
      (error) => console.error("Failed to load live customer queries:", error)
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    setSelectedQueryId(searchParams.get("query") || "");
  }, [searchParams]);

  const selectedQuery = useMemo(() => {
    if (selectedQueryId) {
      return queries.find((item) => item.id === selectedQueryId) || null;
    }

    return queries[0] || null;
  }, [queries, selectedQueryId]);

  useEffect(() => {
    setReplyDraft(selectedQuery?.adminReply || "");
    setFeedback("");
  }, [selectedQuery?.id, selectedQuery?.adminReply]);

  const handleOpenQuery = async (query) => {
    setSearchParams({ query: query.id });
    setSelectedQueryId(query.id);
    setFeedback("");

    if (!query.adminSeen) {
      try {
        await markContactSubmissionAsRead(query.id);
      } catch (error) {
        console.error("Failed to mark query as read:", error);
      }
    }
  };

  const handleReply = async () => {
    if (!selectedQuery?.id || !replyDraft.trim()) {
      return;
    }

    try {
      setSavingReply(true);
      setFeedback("");
      await replyToContactSubmission(selectedQuery.id, replyDraft, "Replied");

      if (selectedQuery.userId) {
        await createUserQueryReplyNotification(
          selectedQuery.userId,
          selectedQuery.id,
          selectedQuery.subject,
          replyDraft
        );
      }

      setFeedback("Reply saved and sent to the customer dashboard.");
    } catch (error) {
      console.error("Failed to reply to customer query:", error);
      setFeedback("We could not save the reply right now. Please try again.");
    } finally {
      setSavingReply(false);
    }
  };

  const columns = [
    { key: "id", label: "Query ID" },
    {
      key: "customer",
      label: "Customer",
      render: (row) => (
        <button type="button" style={styles.linkButton} onClick={() => handleOpenQuery(row)}>
          {row.name}
        </button>
      ),
    },
    { key: "subject", label: "Subject" },
    { key: "status", label: "Status", type: "status" },
    { key: "date", label: "Date" },
  ];

  return (
    <section className="admin-module-section">
      <div className="admin-page-head">
        <div>
          <h2>Customer Queries</h2>
          <p>Read customer messages, reply from the admin panel, and sync those replies back to the user dashboard.</p>
        </div>
      </div>

      <div className="admin-split-grid">
        <div className="admin-module-card">
          <DataTable
            columns={columns}
            rows={queries.map((item) => ({
              ...item,
              customer: item.name,
            }))}
            rowKey="id"
          />
          {queries.length === 0 ? (
            <div className="admin-empty-state" style={styles.emptyState}>
              Customer contact messages will appear here as soon as users submit them.
            </div>
          ) : null}
        </div>

        {selectedQuery ? (
          <aside className="admin-detail-card">
            <div className="admin-page-head compact">
              <div>
                <h3>Query Details</h3>
                <p>{selectedQuery.id}</p>
              </div>
            </div>

            <div className="admin-detail-grid">
              <div><span>Customer</span><strong>{selectedQuery.name}</strong></div>
              <div><span>Email</span><strong>{selectedQuery.email}</strong></div>
              <div><span>Status</span><strong>{selectedQuery.status}</strong></div>
              <div><span>Received</span><strong>{selectedQuery.dateTime}</strong></div>
              <div className="full"><span>Message</span><strong>{selectedQuery.message}</strong></div>
            </div>

            <label style={styles.replyField}>
              <span>Admin Reply</span>
              <textarea
                rows="6"
                value={replyDraft}
                onChange={(event) => setReplyDraft(event.target.value)}
                placeholder="Write the reply that should be shown to the customer."
              />
            </label>

            {feedback ? (
              <div className="admin-empty-state" style={styles.feedback}>
                {feedback}
              </div>
            ) : null}

            <div className="admin-page-actions stretch">
              <button type="button" className="admin-secondary-button" onClick={() => handleOpenQuery(selectedQuery)}>
                Mark As Read
              </button>
              <button
                type="button"
                className="admin-secondary-button"
                disabled={savingReply || !replyDraft.trim()}
                onClick={handleReply}
              >
                {savingReply ? "Saving..." : "Send Reply"}
              </button>
            </div>
          </aside>
        ) : null}
      </div>
    </section>
  );
};

const styles = {
  linkButton: {
    cursor: "pointer",
    color: "#fff2d0",
    fontSize: "0.9rem",
    background: "transparent",
    border: 0,
    padding: 0,
    textAlign: "left",
  },
  emptyState: {
    marginTop: "12px",
  },
  replyField: {
    display: "grid",
    gap: "8px",
    marginTop: "18px",
    color: "#cdb58c",
  },
  feedback: {
    marginTop: "14px",
  },
};

export default Queries;
