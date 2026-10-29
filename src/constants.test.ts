import { SEARCH_TYPE_LABELS, SearchType, toSearchType } from './constants';

describe('SEARCH_TYPE_LABELS', () => {
  it('labels every search type', () => {
    expect(SEARCH_TYPE_LABELS[SearchType.text]).toBe('Text');
    expect(SEARCH_TYPE_LABELS[SearchType.isbn]).toBe('ISBN');
  });
});

describe('toSearchType', () => {
  it('keeps a valid search type', () => {
    expect(toSearchType('isbn')).toBe(SearchType.isbn);
    expect(toSearchType('text')).toBe(SearchType.text);
  });

  it('falls back to text for empty or unknown values', () => {
    expect(toSearchType('')).toBe(SearchType.text);
    expect(toSearchType(undefined)).toBe(SearchType.text);
    expect(toSearchType('unknown')).toBe(SearchType.text);
  });
});
