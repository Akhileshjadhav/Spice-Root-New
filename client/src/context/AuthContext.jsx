import { useEffect, useMemo, useState } from "react";
import {
  browserLocalPersistence,
  browserSessionPersistence,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
} from "firebase/auth";
import { addDoc, collection, doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { adminEmailAllowlist, auth, db, googleProvider, serverTimestamp } from "../firebase";
import { apiRequest } from "../lib/apiClient";
import AuthContext from "./authContext";

const USERS_COLLECTION = "users";
const ADMINS_COLLECTION = "admins";
const AUTH_SESSION_ROLE_KEY = "spice-root-auth-session-role";

function createAuthFlowError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function readSessionRole() {
  if (typeof window === "undefined") {
    return "";
  }

  return window.localStorage.getItem(AUTH_SESSION_ROLE_KEY) || "";
}

function writeSessionRole(value) {
  if (typeof window === "undefined") {
    return;
  }

  if (!value) {
    window.localStorage.removeItem(AUTH_SESSION_ROLE_KEY);
    return;
  }

  window.localStorage.setItem(AUTH_SESSION_ROLE_KEY, value);
}

function isAllowedAdminEmail(email) {
  const normalizedEmail = normalizeEmail(email);
  return Boolean(normalizedEmail) && adminEmailAllowlist.includes(normalizedEmail);
}

function isActiveAdminProfile(adminProfile) {
  if (!adminProfile) {
    return false;
  }

  return String(adminProfile.status || "active").trim().toLowerCase() === "active";
}

function isInactiveAdminProfile(adminProfile) {
  return Boolean(adminProfile) && !isActiveAdminProfile(adminProfile);
}

function canLoginAsAdmin(user, adminProfile) {
  return isAllowedAdminEmail(user?.email) || isActiveAdminProfile(adminProfile);
}

function resolveSessionRole(user, adminProfile, storedRole = "") {
  const hasActiveAdminRecord = isActiveAdminProfile(adminProfile);

  if (isInactiveAdminProfile(adminProfile)) {
    return "user";
  }

  if (storedRole === "admin" && hasActiveAdminRecord) {
    return "admin";
  }

  if (storedRole === "admin" && isAllowedAdminEmail(user?.email)) {
    return "admin";
  }

  return "user";
}

function extractFirstName(value) {
  return String(value || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)[0] || "";
}

function normalizeUserProfile(user, profile = {}, payload = {}) {
  const resolvedName =
    profile.name || payload.name?.trim() || payload.firstName?.trim() || user.displayName || "";
  const resolvedFirstName =
    profile.firstName || payload.firstName?.trim() || extractFirstName(resolvedName);

  return {
    uid: profile.uid || user.uid,
    firstName: resolvedFirstName,
    name: resolvedName,
    email: profile.email || user.email || "",
    phoneNumber: profile.phoneNumber || "",
    alternatePhoneNumber: profile.alternatePhoneNumber || "",
    addressLine1: profile.addressLine1 || "",
    addressLine2: profile.addressLine2 || "",
    city: profile.city || "",
    state: profile.state || "",
    pincode: profile.pincode || "",
    deliveryInstructions: profile.deliveryInstructions || "",
    status: profile.status || "active",
    createdAt: profile.createdAt ?? null,
    updatedAt: profile.updatedAt ?? null,
    lastLoginAt: profile.lastLoginAt ?? null,
  };
}

function normalizeAdminProfile(adminProfile = {}, user = null) {
  if (!adminProfile?.uid && !user?.uid) {
    return null;
  }

  return {
    uid: adminProfile.uid || user?.uid || "",
    email: adminProfile.email || user?.email || "",
    name: adminProfile.name || user?.displayName || "Administrator",
    role: adminProfile.role || "admin",
    status: adminProfile.status || "active",
    createdAt: adminProfile.createdAt ?? null,
  };
}

async function syncUserProfile(user, payload = {}) {
  const userRef = doc(db, USERS_COLLECTION, user.uid);
  const snapshot = await getDoc(userRef);
  const nextName = payload.name?.trim() || payload.firstName?.trim() || user.displayName || "";
  const nextFirstName = payload.firstName?.trim() || extractFirstName(nextName);

  if (!snapshot.exists()) {
    await setDoc(userRef, {
      uid: user.uid,
      firstName: nextFirstName,
      name: nextName,
      email: user.email || "",
      phoneNumber: "",
      alternatePhoneNumber: "",
      addressLine1: "",
      addressLine2: "",
      city: "",
      state: "",
      pincode: "",
      deliveryInstructions: "",
      status:"active",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      lastLoginAt: null,
    });
  } else {
    const profile = snapshot.data();
    const updates = {};
    const resolvedName = profile.name || nextName;
    const resolvedFirstName = profile.firstName || nextFirstName || extractFirstName(resolvedName);
    const nextEmail = user.email || profile.email || "";

    if (profile.uid !== user.uid) {
      updates.uid = user.uid;
    }

    if (profile.firstName !== resolvedFirstName) {
      updates.firstName = resolvedFirstName;
    }

    if (profile.name !== resolvedName) {
      updates.name = resolvedName;
    }

    if (profile.email !== nextEmail) {
      updates.email = nextEmail;
    }

    if (typeof profile.phoneNumber !== "string") {
      updates.phoneNumber = "";
    }

    if (typeof profile.alternatePhoneNumber !== "string") {
      updates.alternatePhoneNumber = "";
    }

    if (typeof profile.addressLine1 !== "string") {
      updates.addressLine1 = "";
    }

    if (typeof profile.addressLine2 !== "string") {
      updates.addressLine2 = "";
    }

    if (typeof profile.city !== "string") {
      updates.city = "";
    }

    if (typeof profile.state !== "string") {
      updates.state = "";
    }

    if (typeof profile.pincode !== "string") {
      updates.pincode = "";
    }

    if (typeof profile.deliveryInstructions !== "string") {
      updates.deliveryInstructions = "";
    }

    if (!Object.prototype.hasOwnProperty.call(profile, "lastLoginAt")) {
      updates.lastLoginAt = null;
    }

    if (!profile.createdAt) {
      updates.createdAt = serverTimestamp();
    }

    if (Object.keys(updates).length > 0) {
      updates.updatedAt = serverTimestamp();
      await updateDoc(userRef, updates);
    }
  }

  const refreshedSnapshot = await getDoc(userRef);
  return normalizeUserProfile(user, refreshedSnapshot.exists() ? refreshedSnapshot.data() : null, payload);
}

async function readAdminProfile(user) {
  if (!user?.uid) {
    return null;
  }

  try {
    await user.getIdToken();
    const adminSnapshot = await getDoc(doc(db, ADMINS_COLLECTION, user.uid));

    if (!adminSnapshot.exists()) {
      return null;
    }

    return normalizeAdminProfile(adminSnapshot.data(), user);
  } catch (error) {
    console.warn("Failed to read admin profile:", error);
    return null;
  }
}

async function recordLoginActivity(user, userProfile, adminProfile, source) {
  const userRef = doc(db, USERS_COLLECTION, user.uid);

  await updateDoc(userRef, {
    firstName: userProfile.firstName,
    name: userProfile.name,
    email: user.email || userProfile.email || "",
    lastLoginAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  await addDoc(collection(db, USERS_COLLECTION, user.uid, "loginEvents"), {
    uid: user.uid,
    email: user.email || userProfile.email || "",
    name: userProfile.name,
    isAdmin: Boolean(adminProfile),
    source,
    createdAt: serverTimestamp(),
  });

  if (adminProfile) {
    await setDoc(
      doc(db, ADMINS_COLLECTION, user.uid),
      {
        uid: user.uid,
        email: user.email || adminProfile.email || "",
        name: adminProfile.name || userProfile.name || user.displayName || "Administrator",
        role: adminProfile.role || "admin",
        status: adminProfile.status || "active",
        lastLoginAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  }
}

async function ensureAdminAccessRecord(user) {
  if (!isAllowedAdminEmail(user.email)) {
    return readAdminProfile(user);
  }

  try {
    await apiRequest("/auth/ensure-admin", {
      user,
      method: "POST",
      body: JSON.stringify({}),
    });
  } catch (error) {
    console.warn("Failed to sync admin access record:", error);
  }

  return readAdminProfile(user);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [adminProfile, setAdminProfile] = useState(null);
  const [sessionRole, setSessionRole] = useState(() => readSessionRole());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function bootstrapAuth() {
      return onAuthStateChanged(auth, async (user) => {
        if (!active) {
          return;
        }

        setLoading(true);
        setCurrentUser(user);

        if (!user) {
          setUserProfile(null);
          setAdminProfile(null);
          setSessionRole("");
          writeSessionRole("");
          setLoading(false);
          return;
        }

        try {
          let profile = null;
          let nextAdminProfile = null;

          try {
            profile = await syncUserProfile(user);
          } catch (profileError) {
            console.error("Failed to sync user profile during auth bootstrap:", profileError);
          }

          if (isAllowedAdminEmail(user.email)) {
            await ensureAdminAccessRecord(user);
          }

          nextAdminProfile = await readAdminProfile(user);

          const storedRole = readSessionRole();
          const resolvedSessionRole = resolveSessionRole(user, nextAdminProfile, storedRole);

          if (active) {
            setUserProfile(profile);
            setAdminProfile(nextAdminProfile);
            setSessionRole(resolvedSessionRole);
            writeSessionRole(resolvedSessionRole);
          }
        } catch (error) {
          console.error("Failed to load auth state:", error);
          if (active) {
            setUserProfile(null);
            setAdminProfile(null);
            setSessionRole("");
            writeSessionRole("");
          }
        } finally {
          if (active) {
            setLoading(false);
          }
        }
      });
    }

    let unsubscribe = () => {};

    bootstrapAuth()
      .then((cleanup) => {
        unsubscribe = cleanup;
      })
      .catch((error) => {
        console.error("Failed to initialize auth:", error);
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  // const registerUser = async ({ firstName, email, password }) => {
  //   if (isAllowedAdminEmail(email)) {
  //     throw createAuthFlowError("auth/admin-only-route", "This account is registered as an admin. Please use the admin login page.");
  //   }

  //   await setPersistence(auth, browserLocalPersistence);
  //   const credentials = await createUserWithEmailAndPassword(auth, email, password);
  //   const normalizedFirstName = firstName.trim();

  //   await updateProfile(credentials.user, {
  //     displayName: normalizedFirstName,
  //   });

  //   const profile = await syncUserProfile(credentials.user, {
  //     firstName: normalizedFirstName,
  //     name: normalizedFirstName,
  //   });

  //   const resolvedSessionRole = "user";
  //   setUserProfile(profile);
  //   setAdminProfile(null);
  //   setSessionRole(resolvedSessionRole);
  //   writeSessionRole(resolvedSessionRole);
  //   setCurrentUser(credentials.user);

  //   return { user: credentials.user, profile };
  // };

const registerUser = async ({ firstName, email, password }) => {
if (isAllowedAdminEmail(email)) {
throw createAuthFlowError(
"auth/admin-only-route",
"This account is registered as an admin. Please use the admin login page."
);
}

await setPersistence(auth, browserLocalPersistence);

const credentials = await createUserWithEmailAndPassword(
auth,
email,
password
);

const normalizedFirstName = firstName.trim();

await updateProfile(credentials.user, {
displayName: normalizedFirstName,
});

const profile = await syncUserProfile(credentials.user, {
firstName: normalizedFirstName,
name: normalizedFirstName,
});

// Logout immediately after registration
await signOut(auth);

setCurrentUser(null);
setUserProfile(null);
setAdminProfile(null);
setSessionRole("");
writeSessionRole("");

return {
user: credentials.user,
profile,
};
};


  const loginUser = async ({ email, password }) => {
    await setPersistence(auth, browserLocalPersistence);
    const credentials = await signInWithEmailAndPassword(auth, email, password);
    const profile = await syncUserProfile(credentials.user);
    const nextAdminProfile = await readAdminProfile(credentials.user);

    if (canLoginAsAdmin(credentials.user, nextAdminProfile)) {
      await signOut(auth);
      setCurrentUser(null);
      setUserProfile(null);
      setAdminProfile(null);
      setSessionRole("");
      writeSessionRole("");
      throw createAuthFlowError(
        "auth/admin-only-route",
        "This email is registered for admin access. Use the admin login page instead."
      );
    }

    await recordLoginActivity(credentials.user, profile, null, "user");

    setCurrentUser(credentials.user);
    setUserProfile(profile);
    setAdminProfile(null);
    setSessionRole("user");
    writeSessionRole("user");
    return { user: credentials.user, profile, adminProfile: null };
  };

  const loginAdmin = async ({ email, password }) => {
    await setPersistence(auth, browserSessionPersistence);
    const credentials = await signInWithEmailAndPassword(auth, email, password);

    if (isAllowedAdminEmail(credentials.user.email)) {
      await ensureAdminAccessRecord(credentials.user);
    }

    let nextAdminProfile = await readAdminProfile(credentials.user);

    if (!canLoginAsAdmin(credentials.user, nextAdminProfile)) {
      await signOut(auth);
      setCurrentUser(null);
      setUserProfile(null);
      setAdminProfile(null);
      setSessionRole("");
      writeSessionRole("");
      throw createAuthFlowError("auth/not-admin", "This email is not allowed in VITE_ADMIN_EMAILS.");
    }

    const profile = await syncUserProfile(credentials.user);

    if (!isActiveAdminProfile(nextAdminProfile)) {
      await signOut(auth);
      setCurrentUser(null);
      setUserProfile(null);
      setAdminProfile(null);
      setSessionRole("");
      writeSessionRole("");
      throw createAuthFlowError(
        "auth/not-admin",
        "This account does not have an active admin profile. Confirm the server is running and try again."
      );
    }

    await recordLoginActivity(credentials.user, profile, nextAdminProfile, "admin");

    setCurrentUser(credentials.user);
    setUserProfile(profile);
    setAdminProfile(nextAdminProfile);
    setSessionRole("admin");
    writeSessionRole("admin");
    return { user: credentials.user, profile, adminProfile: nextAdminProfile };
  };

  const loginWithGoogle = async () => {
    await setPersistence(auth, browserLocalPersistence);
    const credentials = await signInWithPopup(auth, googleProvider);
    const profile = await syncUserProfile(credentials.user, {
      firstName: extractFirstName(credentials.user.displayName || "Google User"),
      name: credentials.user.displayName || "Google User",
    });
    const nextAdminProfile = await readAdminProfile(credentials.user);

    if (canLoginAsAdmin(credentials.user, nextAdminProfile)) {
      await signOut(auth);
      setCurrentUser(null);
      setUserProfile(null);
      setAdminProfile(null);
      setSessionRole("");
      writeSessionRole("");
      throw createAuthFlowError(
        "auth/admin-only-route",
        "This email is registered for admin access. Use the admin login page instead."
      );
    }

    await recordLoginActivity(credentials.user, profile, null, "google-user");

    setCurrentUser(credentials.user);
    setUserProfile(profile);
    setAdminProfile(null);
    setSessionRole("user");
    writeSessionRole("user");
    return { user: credentials.user, profile, adminProfile: null };
  };

  const saveUserProfileDetails = async (details) => {
    if (!auth.currentUser?.uid) {
      throw new Error("User must be logged in to save profile details.");
    }

    const phoneNumber = details.phoneNumber?.trim() || details.mobileNumber?.trim() || "";
    const alternatePhoneNumber =
      details.alternatePhoneNumber?.trim() || details.alternateMobileNumber?.trim() || "";
    const userRef = doc(db, USERS_COLLECTION, auth.currentUser.uid);
    const updates = {
      phoneNumber,
      alternatePhoneNumber,
      addressLine1: details.addressLine1?.trim() || "",
      addressLine2: details.addressLine2?.trim() || "",
      city: details.city?.trim() || "",
      state: details.state?.trim() || "",
      pincode: details.pincode?.trim() || "",
      deliveryInstructions: details.deliveryInstructions?.trim() || "",
      updatedAt: serverTimestamp(),
    };

    if (details.fullName?.trim()) {
      const nextName = details.fullName.trim();
      updates.name = nextName;
      updates.firstName = extractFirstName(nextName);
    }

    await updateDoc(userRef, updates);

    const refreshedSnapshot = await getDoc(userRef);
    const nextProfile = normalizeUserProfile(
      auth.currentUser,
      refreshedSnapshot.exists() ? refreshedSnapshot.data() : null
    );

    setUserProfile(nextProfile);
    return nextProfile;
  };

  const logoutUser = async () => {
    await signOut(auth);
    setUserProfile(null);
    setAdminProfile(null);
    setSessionRole("");
    writeSessionRole("");
  };

  const resetPassword = async (email) => {
    await sendPasswordResetEmail(auth, email);
  };

  const value = useMemo(
    () => ({
      currentUser,
      userProfile,
      adminProfile,
      sessionRole,
      loading,
      isAuthenticated: Boolean(currentUser),
      emailVerified: true,
      hasAdminAccess: !isInactiveAdminProfile(adminProfile) && (
        isActiveAdminProfile(adminProfile) || isAllowedAdminEmail(currentUser?.email)
      ),
      isAdmin:
        sessionRole === "admin" &&
        !isInactiveAdminProfile(adminProfile) &&
        (isActiveAdminProfile(adminProfile) || isAllowedAdminEmail(currentUser?.email)),
      isCustomer: Boolean(currentUser) && sessionRole === "user",
      registerUser,
      loginUser,
      loginAdmin,
      loginWithGoogle,
      logoutUser,
      resetPassword,
      saveUserProfileDetails,
    }),
    [adminProfile, currentUser, loading, sessionRole, userProfile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
