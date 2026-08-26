// Test helper: a stand-in for the `firebase/firestore` real-time API that lets a
// test decide exactly when a listener delivers its first snapshot (or fails).
// That timing is the whole point of the loading flags, so it cannot be left to
// the real SDK.
import { vi } from "vitest";

// Every onSnapshot registration, in call order.
export const listeners = [];

export function resetListeners() {
  listeners.length = 0;
}

// `collection(db, "users", uid, "recipes")` becomes { path: "users/<uid>/recipes" }
// so a test can address one specific listener when a hook opens several.
export const firestoreMock = {
  collection: (_db, ...segments) => ({ path: segments.join("/") }),
  query: (ref) => ref,
  orderBy: (field) => ({ orderBy: field }),
  onSnapshot: (ref, onNext, onError) => {
    const entry = { path: ref.path, onNext, onError, active: true };
    listeners.push(entry);
    return () => {
      entry.active = false;
    };
  },
  doc: (_db, ...segments) => ({ path: segments.join("/") }),
  addDoc: vi.fn(),
  updateDoc: vi.fn(),
  deleteDoc: vi.fn(),
  writeBatch: vi.fn(() => ({ update: vi.fn(), commit: vi.fn() })),
};

function find(path) {
  const entry = [...listeners].reverse().find((l) => l.active && l.path === path);
  if (!entry) {
    throw new Error(
      `No active listener for "${path}". Registered: ${listeners
        .map((l) => `${l.path}${l.active ? "" : " (torn down)"}`)
        .join(", ") || "(none)"}`,
    );
  }
  return entry;
}

// Delivers a snapshot to the listener on `path`. `docs` is [{ id, ...fields }].
export function emitSnapshot(path, docs = []) {
  find(path).onNext({
    docs: docs.map(({ id, ...data }) => ({ id, data: () => data })),
  });
}

export function emitError(path, err = new Error("permission-denied")) {
  find(path).onError(err);
}
