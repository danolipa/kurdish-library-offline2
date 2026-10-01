import type { Book } from "./types";

const DB_NAME = "kurdish-library";
const DB_VERSION = 1;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("books")) db.createObjectStore("books", { keyPath: "id" });
      if (!db.objectStoreNames.contains("files")) db.createObjectStore("files");
      if (!db.objectStoreNames.contains("progress")) db.createObjectStore("progress");
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveBook(book: Book, file?: Blob) {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(["books", "files"], "readwrite");
    tx.objectStore("books").put(book);
    if (file) tx.objectStore("files").put(file, book.id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function getBooks(): Promise<Book[]> {
  const db = await openDb();
  const books = await new Promise<Book[]>((resolve, reject) => {
    const request = db.transaction("books").objectStore("books").getAll();
    request.onsuccess = () => resolve(request.result as Book[]);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return books.sort((a, b) => b.addedAt - a.addedAt);
}

export async function getBookFile(id: string): Promise<Blob | undefined> {
  const db = await openDb();
  const file = await new Promise<Blob | undefined>((resolve, reject) => {
    const request = db.transaction("files").objectStore("files").get(id);
    request.onsuccess = () => resolve(request.result as Blob | undefined);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return file;
}

export async function saveProgress(id: string, value: number) {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("progress", "readwrite");
    tx.objectStore("progress").put(value, id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function getProgress(id: string): Promise<number> {
  const db = await openDb();
  const value = await new Promise<number>((resolve, reject) => {
    const request = db.transaction("progress").objectStore("progress").get(id);
    request.onsuccess = () => resolve(typeof request.result === "number" ? request.result : 0);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return value;
}