import { auth } from "../firebase";

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

  return fetch(path, { ...options, headers });
}
