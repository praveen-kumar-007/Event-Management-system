const LOCAL_API_URL = (
  import.meta.env.VITE_API_URL || "http://localhost:5000"
).replace(/\/+$/, "");

const PROD_API_URL = (
  import.meta.env.VITE_API_URL ||
  "https://event-management-system-4k9h.onrender.com"
).replace(/\/+$/, "");

export const API_URL = import.meta.env.PROD ? PROD_API_URL : LOCAL_API_URL;
