import { onSnapshot } from "firebase/firestore";

function reportFirestoreError(error, onError) {
  if (onError) {
    onError(error);
    return;
  }

  console.error("Firestore listener failed:", error);
}

export function safeUnsubscribe(unsubscribe, onError) {
  if (typeof unsubscribe !== "function") {
    return;
  }

  try {
    unsubscribe();
  } catch (error) {
    reportFirestoreError(error, onError);
  }
}

export function subscribeSafely(source, onNext, onError) {
  let unsubscribe = () => {};

  try {
    unsubscribe = onSnapshot(source, onNext, (error) => reportFirestoreError(error, onError));
  } catch (error) {
    reportFirestoreError(error, onError);
  }

  return () => safeUnsubscribe(unsubscribe, onError);
}

export function cleanupSubscriptions(unsubscribers, onError) {
  unsubscribers.forEach((unsubscribe) => safeUnsubscribe(unsubscribe, onError));
}
