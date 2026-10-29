export enum ServiceProvider {
  openlibrary = 'openlibrary',
  google = 'google',
  naver = 'naver',
  openbd = 'openbd',
}

export enum SearchType {
  text = 'text',
  isbn = 'isbn',
}

export const SEARCH_TYPE_LABELS: Record<SearchType, string> = {
  [SearchType.text]: 'Text',
  [SearchType.isbn]: 'ISBN',
};

export function toSearchType(value?: string): SearchType {
  return value === SearchType.isbn ? SearchType.isbn : SearchType.text;
}
