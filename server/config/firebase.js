const admin = require("firebase-admin");
const dotenv = require("dotenv");
const path = require("path");
const fs = require("fs");

dotenv.config();

const initializeFirebase = () => {
  try {
    const jsonPath = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    const dbUrl = process.env.FIREBASE_DATABASE_URL;

    if (jsonPath) {
      let serviceAccount;
      // Try to parse as raw JSON string first
      try {
        serviceAccount = JSON.parse(jsonPath);
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          databaseURL: dbUrl,
        });
        console.log(
          "✅ Firebase Admin Initialized via Raw JSON string in .env",
        );
      } catch (parseError) {
        // If parsing fails, assume it's a file path
        const absolutePath = path.resolve(process.cwd(), jsonPath);
        if (fs.existsSync(absolutePath)) {
          serviceAccount = JSON.parse(fs.readFileSync(absolutePath, "utf8"));
          admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            databaseURL: dbUrl,
          });
          console.log("✅ Firebase Admin Initialized via JSON file:", jsonPath);
        } else {
          console.warn(
            "⚠️ Firebase Service Account JSON is neither valid JSON nor a valid file path:",
            absolutePath,
          );
        }
      }
    } else {
      console.warn("⚠️ FIREBASE_SERVICE_ACCOUNT_JSON not defined in .env");
    }
  } catch (error) {
    console.error("❌ Firebase Initialization Error:", error.message);
  }
};

initializeFirebase();

const db = admin.apps.length > 0 ? admin.firestore() : null;
let firestoreDisabled = false;

const shouldDisableFirestore = (error) => {
  const code = Number(error?.code || error?.status || error?.statusCode);
  const message = `${error?.message || ""}`.toLowerCase();

  return (
    code === 5 ||
    code === 14 ||
    message.includes("name resolution failed") ||
    message.includes("unavailable") ||
    message.includes("failed to fetch") ||
    message.includes("firestore")
  );
};

const markFirestoreUnavailable = (error) => {
  if (!db) {
    firestoreDisabled = true;
    return;
  }

  if (shouldDisableFirestore(error)) {
    firestoreDisabled = true;
  }
};

const isFirestoreAvailable = () => Boolean(db) && !firestoreDisabled;

module.exports = {
  admin,
  db,
  isFirestoreAvailable,
  markFirestoreUnavailable,
};
