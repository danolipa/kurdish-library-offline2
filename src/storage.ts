import type { Author, Book, BookState, Highlight, Quote, Summary } from "./types";

const DB_NAME = "kurdish-library";
const DB_VERSION = 5;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("books")) db.createObjectStore("books", { keyPath: "id" });
      if (!db.objectStoreNames.contains("files")) db.createObjectStore("files");
      if (!db.objectStoreNames.contains("progress")) db.createObjectStore("progress");
      if (!db.objectStoreNames.contains("states")) db.createObjectStore("states");
      if (!db.objectStoreNames.contains("summaries")) db.createObjectStore("summaries", { keyPath: "id" });
      if (!db.objectStoreNames.contains("quotes")) db.createObjectStore("quotes", { keyPath: "id" });
      if (!db.objectStoreNames.contains("authors")) db.createObjectStore("authors", { keyPath: "id" });
      if (!db.objectStoreNames.contains("text")) db.createObjectStore("text");
      if (!db.objectStoreNames.contains("highlights")) db.createObjectStore("highlights", { keyPath: "id" });
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

export async function getBookState(id: string): Promise<BookState> {
  const db = await openDb();
  const state = await new Promise<BookState | undefined>((resolve, reject) => {
    const request = db.transaction("states").objectStore("states").get(id);
    request.onsuccess = () => resolve(request.result as BookState | undefined);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return state ?? { favorite: false, bookmark: false, note: "", progress: 0 };
}

export async function saveBookState(id: string, patch: Partial<BookState>) {
  const current = await getBookState(id);
  const next = { ...current, ...patch };
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("states", "readwrite");
    tx.objectStore("states").put(next, id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function saveProgress(id: string, value: number) {
  const now = Date.now();
  await saveBookState(id, {
    progress: Math.max(0, Math.min(1, value)),
    lastReadAt: now,
    updatedAt: now
  });
}

export async function getProgress(id: string): Promise<number> {
  return (await getBookState(id)).progress;
}

async function getAll<T>(storeName: string): Promise<T[]> {
  const db = await openDb();
  const items = await new Promise<T[]>((resolve, reject) => {
    const request = db.transaction(storeName).objectStore(storeName).getAll();
    request.onsuccess = () => resolve(request.result as T[]);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return items;
}

async function putAll<T>(storeName: string, items: T[]) {
  if (!items.length) return;
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    const store = tx.objectStore(storeName);
    for (const item of items) store.put(item);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function getSummaries(): Promise<Summary[]> { return getAll<Summary>("summaries"); }
export async function saveSummaries(items: Summary[]) { return putAll("summaries", items); }
export async function getQuotes(): Promise<Quote[]> { return getAll<Quote>("quotes"); }
export async function saveQuotes(items: Quote[]) { return putAll("quotes", items); }
export async function getAuthors(): Promise<Author[]> { return getAll<Author>("authors"); }
export async function saveAuthors(items: Author[]) { return putAll("authors", items); }

export async function saveExtractedText(id:string,text:string){
  const db=await openDb();
  await new Promise<void>((resolve,reject)=>{const tx=db.transaction("text","readwrite");tx.objectStore("text").put(text,id);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);});
  db.close();
}
export async function getExtractedText(id:string):Promise<string>{
  const db=await openDb();
  const value=await new Promise<string>((resolve,reject)=>{const r=db.transaction("text").objectStore("text").get(id);r.onsuccess=()=>resolve((r.result as string)||"");r.onerror=()=>reject(r.error);});
  db.close(); return value;
}

export async function getHighlights(bookId?: string): Promise<Highlight[]> {
  const items = await getAll<Highlight>("highlights");
  return bookId ? items.filter(x => x.bookId === bookId).sort((a,b)=>b.createdAt-a.createdAt) : items;
}
export async function saveHighlight(item: Highlight) { return putAll("highlights", [item]); }
export async function deleteHighlight(id: string) {
  const db = await openDb();
  await new Promise<void>((resolve,reject)=>{const tx=db.transaction("highlights","readwrite");tx.objectStore("highlights").delete(id);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);});
  db.close();
}
