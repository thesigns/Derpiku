// Persistent app state: IndexedDB, falling back to localStorage. Everything stays on the device.
const DB_NAME = 'derpiku';
const STORE = 'kv';
const FALLBACK_PREFIX = 'derpiku:';
let dbPromise = null;

function openDb() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      if (!('indexedDB' in self)) {
        reject(new Error('IndexedDB unavailable'));
        return;
      }
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

export async function load(key) {
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const req = db.transaction(STORE).objectStore(STORE).get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    try {
      const raw = localStorage.getItem(FALLBACK_PREFIX + key);
      return raw ? JSON.parse(raw) : undefined;
    } catch (e2) {
      return undefined;
    }
  }
}

export async function save(key, value) {
  try {
    const db = await openDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    try {
      localStorage.setItem(FALLBACK_PREFIX + key, JSON.stringify(value));
    } catch (e2) {
      // No persistent storage: the state lives only until the app is closed.
    }
  }
}
