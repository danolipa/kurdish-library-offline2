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

export type BookState = {
  favorite: boolean;
  bookmark: boolean;
  note: string;
  progress: number;
};