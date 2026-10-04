import { KnowledgeTree } from "../types/graph";

const dbName = "tree-knowledge-explorer";
const storeName = "trees";
const currentTreeKey = "current-tree";
const fallbackKey = "tree-knowledge-explorer:current";

export async function loadStoredTree(): Promise<KnowledgeTree | null> {
  try {
    const database = await openDatabase();
    const tree = await requestToPromise<KnowledgeTree | undefined>(
      database.transaction(storeName, "readonly").objectStore(storeName).get(currentTreeKey),
    );
    database.close();
    return tree ?? null;
  } catch {
    return loadLocalStorageTree();
  }
}

export async function saveStoredTree(tree: KnowledgeTree): Promise<void> {
  try {
    const database = await openDatabase();
    const transaction = database.transaction(storeName, "readwrite");
    transaction.objectStore(storeName).put(tree, currentTreeKey);
    await transactionDone(transaction);
    database.close();
  } catch {
    window.localStorage.setItem(fallbackKey, JSON.stringify(tree));
  }
}

export async function clearStoredTree(): Promise<void> {
  try {
    const database = await openDatabase();
    const transaction = database.transaction(storeName, "readwrite");
    transaction.objectStore(storeName).delete(currentTreeKey);
    await transactionDone(transaction);
    database.close();
  } catch {
    window.localStorage.removeItem(fallbackKey);
  }
}

function loadLocalStorageTree(): KnowledgeTree | null {
  try {
    const stored = window.localStorage.getItem(fallbackKey);
    return stored ? (JSON.parse(stored) as KnowledgeTree) : null;
  } catch {
    return null;
  }
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(dbName, 1);

    request.onupgradeneeded = () => {
      request.result.createObjectStore(storeName);
    };
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
    transaction.oncomplete = () => resolve();
  });
}
