export interface OpenLibraryBooksResponse {
  numFound: number;
  start: number;
  docs: OpenLibraryBookItem[];
}

export interface OpenLibraryBookItem {
  title: string;
  subtitle?: string;
  author_name?: string[];
  cover_i?: string;
  isbn: string[];
  number_of_pages_median?: number;
  publish_date?: string[];
  publisher?: string[];
  language?: string[];
  format?: string[];
  subject?: string[];
}
