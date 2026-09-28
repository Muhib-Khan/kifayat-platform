const admin = require("firebase-admin");
const { getAuth } = require("firebase-admin/auth");
const fs = require("fs");
const path = require("path");

// Tracks the project that Firebase Admin was actually initialized with.
// Exported so the /api/health/firebase endpoint can surface it for debugging.
let _activeProjectId = null;

/**
 * Load a service account JSON file.
 * Uses fs.readFileSync + JSON.parse intentionally — NOT require() — so that
 * Node.js module caching never serves a stale file after it has been replaced.
 */
const loadServiceAccount = (filePath) => {
  const raw = fs.readFileSync(filePath, "utf8");
  const sa = JSON.parse(raw);

  // Normalize escaped newlines in private_key.
  // Required when the key was copy-pasted into a .env value (\\n → \n).
  // When read from a proper JSON file the newlines are already real, so
  // this replace is a no-op — safe to run in either case.
  if (sa.private_key && typeof sa.private_key === "string") {
    sa.private_key = sa.private_key.replace(/\\n/g, "\n");
  }
  return sa;
};

const initializeFirebaseAdmin = () => {
  if (admin.getApps().length > 0) {
    return admin;
  }

  try {
    // ── Priority 1: local firebase-service-account.json ─────────────────
    const localAccountPath = path.join(
      __dirname,
      "../firebase-service-account.json",
    );
    if (fs.existsSync(localAccountPath)) {
      const sa = loadServiceAccount(localAccountPath);
      admin.initializeApp({ credential: admin.cert(sa) });
      _activeProjectId = sa.project_id;
      console.log(`✅ Firebase Admin ready  project=${_activeProjectId}`);
      console.log(`   account=${sa.client_email}`);
      return admin;
    }

    // ── Priority 2: path supplied via .env ───────────────────────────────
    if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
      const p = path.resolve(process.env.FIREBASE_SERVICE_ACCOUNT_PATH);
      if (!fs.existsSync(p)) {
        throw new Error(`Service account not found at ${p}`);
      }
      const sa = loadServiceAccount(p);
      admin.initializeApp({ credential: admin.cert(sa) });
      _activeProjectId = sa.project_id;
      console.log(`✅ Firebase Admin ready  project=${_activeProjectId}`);
      return admin;
    }

    // ── Priority 3: JSON string in .env ──────────────────────────────────
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      if (sa.private_key) sa.private_key = sa.private_key.replace(/\\n/g, "\n");
      admin.initializeApp({ credential: admin.cert(sa) });
      _activeProjectId = sa.project_id;
      console.log(`✅ Firebase Admin ready  project=${_activeProjectId}`);
      return admin;
    }

    // ── Priority 4: GCP Application Default Credentials ─────────────────
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      const projectId = process.env.FIREBASE_PROJECT_ID;
      admin.initializeApp({
        credential: admin.applicationDefault(),
        ...(projectId && { projectId }),
      });
      _activeProjectId = projectId || "from-gcp-metadata";
      console.log(`✅ Firebase Admin ready  project=${_activeProjectId}`);
      return admin;
    }

    // ── No credentials found ─────────────────────────────────────────────
    console.error("❌ Firebase Admin: no service account found.");
    console.error(
      "   → firebase-service-account.json is missing from the backend root.",
    );
    console.error(
      "   → Download it from Firebase Console > Project Settings > Service Accounts.",
    );
    _activeProjectId = null;
    admin.initializeApp({ projectId: "kifayat--auth-data" });
    return admin;
  } catch (err) {
    console.error("❌ Firebase Admin init failed:", err.message);
    _activeProjectId = null;
    admin.initializeApp({ projectId: "kifayat--auth-data" });
    return admin;
  }
};

initializeFirebaseAdmin();

const verifyFirebaseToken = async (idToken) => {
  return getAuth().verifyIdToken(idToken);
};

const getActiveProjectId = () => _activeProjectId;

module.exports = { verifyFirebaseToken, getActiveProjectId };
