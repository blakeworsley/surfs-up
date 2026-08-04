/**
 * localStorage that never throws. Private browsing, disabled storage and the
 * Node test environment all fall back to an in-memory map, so callers can just
 * read and write without guarding every access.
 */
const memory = new Map();

function backing() {
  try {
    if (typeof localStorage !== 'undefined') {
      const probe = '__surfsup__';
      localStorage.setItem(probe, '1');
      localStorage.removeItem(probe);
      return localStorage;
    }
  } catch {
    // Storage exists but is blocked — fall through to memory.
  }
  return null;
}

const store = backing();

export function read(key, fallback = null) {
  try {
    const value = store ? store.getItem(key) : memory.get(key);
    return value === null || value === undefined ? fallback : value;
  } catch {
    return fallback;
  }
}

export function write(key, value) {
  try {
    if (store) {
      store.setItem(key, String(value));
    } else {
      memory.set(key, String(value));
    }
  } catch {
    // Nothing we can do, and nothing worth interrupting the game for.
  }
}

export function readNumber(key, fallback = 0) {
  const parsed = Number(read(key, fallback));
  return Number.isFinite(parsed) ? parsed : fallback;
}
