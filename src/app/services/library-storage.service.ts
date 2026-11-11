import { Injectable } from '@angular/core';
import type { LibraryMode } from '../models/library.models';

export interface PersistedLibraryItem {
  id: string;
  name: string;
  pgn: string;
  mode: LibraryMode;
  woodpeckerInitialTargetDays?: number;
  createdAt?: number;
}

export const LEGACY_LIBRARY_STORAGE_KEY = 'puzzle-droid-library-items-v1';

const DB_NAME = 'puzzle-droid';
const DB_VERSION = 1;
const STORE_NAME = 'library-items';

/**
 * Persists imported PGN collections in IndexedDB (no ~5 MB localStorage cap, per-item writes).
 * Data saved by older versions in localStorage is migrated on first load. When IndexedDB is not
 * available the service falls back to the legacy localStorage key.
 */
@Injectable({
  providedIn: 'root',
})
export class LibraryStorageService {
  private cache: PersistedLibraryItem[] = [];
  private loadPromise: Promise<PersistedLibraryItem[]> | null = null;
  private dbPromise: Promise<IDBDatabase | null> | null = null;

  constructor() {
    void this.loadAll();
  }

  /** Last known items, newest first. Filled asynchronously after the initial load. */
  snapshot(): readonly PersistedLibraryItem[] {
    return this.cache;
  }

  /** Resolves with all persisted items (newest first) once the initial load/migration is done. */
  async loadAll(): Promise<PersistedLibraryItem[]> {
    this.loadPromise ??= this.readInitialItems();
    await this.loadPromise;
    return [...this.cache];
  }

  async putItems(items: PersistedLibraryItem[]): Promise<void> {
    if (items.length === 0) return;
    await this.loadAll();

    const db = await this.openDb();
    if (db) {
      await runTransaction(db, 'readwrite', (store) => items.forEach((item) => store.put(item)));
    }

    const ids = new Set(items.map((item) => item.id));
    this.cache = sortNewestFirst([...items, ...this.cache.filter((item) => !ids.has(item.id))]);
    if (!db) writeLegacy(this.cache);
  }

  async deleteItem(itemId: string): Promise<void> {
    await this.loadAll();

    const db = await this.openDb();
    if (db) {
      await runTransaction(db, 'readwrite', (store) => store.delete(itemId));
    }

    this.cache = this.cache.filter((item) => item.id !== itemId);
    if (!db) writeLegacy(this.cache);
  }

  async replaceAll(items: PersistedLibraryItem[]): Promise<void> {
    await this.loadAll();

    const db = await this.openDb();
    if (db) {
      await runTransaction(db, 'readwrite', (store) => {
        store.clear();
        items.forEach((item) => store.put(item));
      });
    }

    this.cache = sortNewestFirst(items);
    if (!db) writeLegacy(this.cache);
  }

  private async readInitialItems(): Promise<PersistedLibraryItem[]> {
    const db = await this.openDb();
    if (!db) {
      this.cache = sortNewestFirst(readLegacy());
      return this.cache;
    }

    let legacy: PersistedLibraryItem[] = [];
    try {
      const stored = await runRequest<PersistedLibraryItem[]>(db, (store) => store.getAll());
      legacy = readLegacy();
      const storedIds = new Set(stored.map((item) => item.id));
      const toMigrate = legacy.filter((item) => !storedIds.has(item.id));
      if (toMigrate.length > 0) {
        await runTransaction(db, 'readwrite', (store) => toMigrate.forEach((item) => store.put(item)));
        stored.push(...toMigrate);
      }
      if (legacy.length > 0) {
        removeLegacy();
      }
      this.cache = sortNewestFirst(stored);
    } catch {
      this.cache = sortNewestFirst(legacy.length > 0 ? legacy : readLegacy());
    }

    return this.cache;
  }

  private openDb(): Promise<IDBDatabase | null> {
    this.dbPromise ??= new Promise<IDBDatabase | null>((resolve) => {
      if (typeof indexedDB === 'undefined') {
        resolve(null);
        return;
      }

      try {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = () => {
          if (!request.result.objectStoreNames.contains(STORE_NAME)) {
            request.result.createObjectStore(STORE_NAME, { keyPath: 'id' });
          }
        };
        request.onsuccess = () => {
          const db = request.result;
          db.onversionchange = () => {
            db.close();
            this.dbPromise = null;
          };
          resolve(db);
        };
        request.onerror = () => resolve(null);
        request.onblocked = () => resolve(null);
      } catch {
        resolve(null);
      }
    });

    return this.dbPromise;
  }
}

function runTransaction(db: IDBDatabase, mode: IDBTransactionMode, work: (store: IDBObjectStore) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, mode);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction aborted'));
    work(transaction.objectStore(STORE_NAME));
  });
}

function runRequest<T>(db: IDBDatabase, work: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const request = work(db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function sortNewestFirst(items: PersistedLibraryItem[]): PersistedLibraryItem[] {
  return [...items].sort((left, right) => (right.createdAt ?? 0) - (left.createdAt ?? 0));
}

function readLegacy(): PersistedLibraryItem[] {
  if (typeof localStorage === 'undefined') return [];

  try {
    const parsed = JSON.parse(localStorage.getItem(LEGACY_LIBRARY_STORAGE_KEY) ?? '[]') as unknown;
    if (!Array.isArray(parsed)) return [];

    // Legacy arrays are ordered newest first: derive createdAt to keep that order after migration.
    const now = Date.now();
    return parsed
      .filter((entry): entry is PersistedLibraryItem => Boolean(entry) && typeof entry === 'object' && typeof entry.id === 'string')
      .map((entry, index) => ({ ...entry, createdAt: typeof entry.createdAt === 'number' ? entry.createdAt : now - index }));
  } catch {
    return [];
  }
}

function writeLegacy(items: PersistedLibraryItem[]): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(LEGACY_LIBRARY_STORAGE_KEY, JSON.stringify(items));
}

function removeLegacy(): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.removeItem(LEGACY_LIBRARY_STORAGE_KEY);
  } catch {
    // Ignore: the legacy copy is only a leftover.
  }
}
