import { auth } from "../firebase";

// Where the Express backend lives.
//
// Local dev: leave VITE_API_BASE_URL unset — paths stay relative and Vite's dev
// proxy (vite.config.js) forwards /api to localhost:3000.
// Deployed: the frontend (static host) and the backend (Node host) are on
// different origins, so set VITE_API_BASE_URL to the backend's public URL at
// build time, e.g. https://smart-kitchen-api.onrender.com
const API_BASE = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/+$/, "");

export function apiUrl(path) {
  return `${API_BASE}${path}`;
}

// fetch() wrapper that attaches the current user's Firebase ID token as a
// Bearer Authorization header. Use for protected backend endpoints (/api/ai/*).
export async function authedFetch(path, options = {}) {
  const user = auth.currentUser;
  if (!user) {
    throw new Error("Not authenticated");
  }

  const token = await user.getIdToken();
  const headers = {
    ...(options.headers || {}),
    Authorization: `Bearer ${token}`,
  };

  return fetch(apiUrl(path), { ...options, headers });
}
