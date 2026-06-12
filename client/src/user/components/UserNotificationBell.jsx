import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FaBell } from "react-icons/fa";
import { useAuth } from "../../context/useAuth";
import {
  markContactReplyAsSeen,
  subscribeToUserContactSubmissions,
} from "../../lib/adminStore";

function UserNotificationBell({ variant = "catalog" }) {
  const { currentUser, userProfile } = useAuth();
  const buttonRef = useRef(null);
  const [replies, setReplies] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [openedReplies, setOpenedReplies] = useState([]);
  const [popoverPosition, setPopoverPosition] = useState({ top: 96, right: 20 });

  const email = userProfile?.email || currentUser?.email || "";

  useEffect(() => {
    const unsubscribe = subscribeToUserContactSubmissions(
      currentUser?.uid || "",
      email,
      setReplies,
      (error) => console.error("Failed to load user reply notifications:", error)
    );

    return () => unsubscribe();
  }, [currentUser?.uid, email]);

  const unreadReplies = useMemo(
    () => replies.filter((item) => item.adminReply && !item.userReplySeen),
    [replies]
  );

  const handleOpen = async () => {
    const visibleReplies = unreadReplies.length > 0
      ? unreadReplies
      : replies.filter((item) => item.adminReply).slice(0, 3);
    const buttonRect = buttonRef.current?.getBoundingClientRect();

    if (buttonRect) {
      setPopoverPosition({
        top: Math.round(buttonRect.bottom + 12),
        right: Math.max(16, Math.round(window.innerWidth - buttonRect.right)),
      });
    }

    setOpenedReplies(visibleReplies);
    setIsOpen(true);

    await Promise.all(
      unreadReplies.map((item) =>
        markContactReplyAsSeen(item.id).catch((error) => {
          console.error("Failed to mark admin reply as seen:", error);
        })
      )
    );
  };

  if (!currentUser?.uid || (unreadReplies.length === 0 && !isOpen)) {
    return null;
  }

  const buttonStyle = variant === "ember" ? styles.emberButton : styles.catalogButton;
  const popover = isOpen ? (
    <div
      style={{
        ...styles.popover,
        top: popoverPosition.top,
        right: popoverPosition.right,
      }}
      role="dialog"
      aria-modal="false"
    >
      <div style={styles.popoverHead}>
        <strong>Admin Replies</strong>
        <button type="button" style={styles.closeButton} onClick={() => setIsOpen(false)}>
          Close
        </button>
      </div>

      <div style={styles.list}>
        {openedReplies.map((item) => (
          <article key={item.id} style={styles.replyCard}>
            <strong>{item.subject}</strong>
            <span>{item.dateTime}</span>
            <p>{item.adminReply}</p>
          </article>
        ))}
      </div>
    </div>
  ) : null;

  return (
    <div style={styles.shell}>
      <button
        ref={buttonRef}
        type="button"
        style={buttonStyle}
        onClick={handleOpen}
        aria-label={`Open ${unreadReplies.length} admin repl${unreadReplies.length === 1 ? "y" : "ies"}`}
        title="Admin replies"
      >
        <FaBell />
        <span style={styles.count}>{unreadReplies.length}</span>
      </button>

      {popover ? createPortal(popover, document.body) : null}
    </div>
  );
}

const styles = {
  shell: {
    position: "relative",
    display: "inline-flex",
  },
  catalogButton: {
    width: "42px",
    height: "42px",
    display: "inline-grid",
    placeItems: "center",
    position: "relative",
    borderRadius: "999px",
    border: "1px solid rgba(247, 164, 0, 0.28)",
    background: "rgba(247, 164, 0, 0.14)",
    color: "#ffe1a8",
    cursor: "pointer",
  },
  emberButton: {
    width: "42px",
    height: "42px",
    display: "inline-grid",
    placeItems: "center",
    position: "relative",
    borderRadius: "999px",
    border: "1px solid rgba(247, 164, 0, 0.3)",
    background: "rgba(35, 20, 8, 0.82)",
    color: "#ffe1a8",
    cursor: "pointer",
  },
  count: {
    minWidth: "18px",
    height: "18px",
    display: "inline-grid",
    placeItems: "center",
    position: "absolute",
    top: "-5px",
    right: "-5px",
    borderRadius: "999px",
    background: "#f7a400",
    color: "#2a1802",
    fontSize: "0.72rem",
    fontWeight: 800,
  },
  popover: {
    width: "min(340px, 88vw)",
    position: "fixed",
    zIndex: 10000,
    padding: "16px",
    borderRadius: "18px",
    border: "1px solid rgba(255,255,255,0.1)",
    background: "#1f1610",
    boxShadow: "0 24px 64px rgba(0,0,0,0.35)",
    color: "#fff7e8",
  },
  popoverHead: {
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    alignItems: "center",
    marginBottom: "12px",
  },
  closeButton: {
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: "999px",
    padding: "6px 10px",
    background: "rgba(255,255,255,0.06)",
    color: "#fff7e8",
    cursor: "pointer",
  },
  list: {
    display: "grid",
    gap: "10px",
  },
  replyCard: {
    display: "grid",
    gap: "6px",
    padding: "12px",
    borderRadius: "12px",
    background: "rgba(255,255,255,0.05)",
    lineHeight: 1.45,
  },
};

export default UserNotificationBell;
