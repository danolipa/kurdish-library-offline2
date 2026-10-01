export type BookFormat = "pdf" | "epub" | "txt" | "html" | "unknown";

export type Book = {
  id: string;
  title: string;
  author: string;
  category: string;
  language: string;
  format: BookFormat;
  fileName?: string;
  filePath?: string;
  coverPath?: string;
  summary?: string;
  summaryKu?: string;
  tags?: string[];
  sizeBytes?: number;
  addedAt: number;
  source: "bundle" | "import";
};

export type Highlight = {
  id: string;
  bookId: string;
  page?: number;
  text: string;
  note?: string;
  color?: string;
  createdAt: number;
};

export type Note = {
  id: string;
  bookId: string;
  title: string;
  body: string;
  page?: number;
  tags?: string[];
  color?: string;
  createdAt: number;
  updatedAt: number;
};

export type BookState = {
  favorite: boolean;
  bookmark: boolean;
  bookmarkPage?: number;
  note: string;
  progress: number;
  lastReadAt?: number;
  updatedAt?: number;
  highlights?: Highlight[];
};

export type Summary = {
  id: string;
  bookId: string;
  title: string;
  textKu: string;
  textOriginal?: string;
  wordCount?: number;
  source?: string;
  sourceUrl?: string;
  rights?: string;
  updatedAt?: string;
};

export type Quote = {
  id: string;
  textOriginal: string;
  textKu: string;
  author: string;
  authorId?: string;
  source?: string;
  sourceUrl?: string;
  rights?: string;
  imagePath?: string;
  updatedAt?: string;
};

export type Author = {
  id: string;
  name: string;
  bioKu?: string;
  imagePath?: string;
  source?: string;
  sourceUrl?: string;
  rights?: string;
};
