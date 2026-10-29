import { getLanguageName, resolveLanguage } from './book_languages';
import {
  DEFAULT_MEDIA_TYPE,
  isComicSeries,
  normalizeBookFormat,
  normalizeOnixProductForm,
  resolveGoogleBooksMediaType,
  resolveOpenLibraryMediaType,
} from './book_media_type';

describe('getLanguageName', () => {
  it('resolves ISO 639-1 codes', () => {
    expect(getLanguageName('en')).toEqual('English');
    expect(getLanguageName('ja')).toEqual('Japanese');
    expect(getLanguageName('ko')).toEqual('Korean');
  });

  it('resolves ISO 639-2 codes used by Open Library', () => {
    expect(getLanguageName('eng')).toEqual('English');
    expect(getLanguageName('jpn')).toEqual('Japanese');
    expect(getLanguageName('fre')).toEqual('French');
    expect(getLanguageName('ger')).toEqual('German');
    expect(getLanguageName('kor')).toEqual('Korean');
  });

  it('resolves terminological and bibliographic variants', () => {
    expect(getLanguageName('fra')).toEqual('French');
    expect(getLanguageName('deu')).toEqual('German');
    expect(getLanguageName('zho')).toEqual('Chinese');
    expect(getLanguageName('chi')).toEqual('Chinese');
  });

  it('resolves three letter codes without an ISO 639-1 equivalent', () => {
    expect(getLanguageName('ast')).toEqual('Asturian');
    expect(getLanguageName('ceb')).toEqual('Cebuano');
  });

  it('resolves Tibetan, which has no runtime display name', () => {
    expect(getLanguageName('bo')).toEqual('Tibetan');
    expect(getLanguageName('bod')).toEqual('Tibetan');
    expect(getLanguageName('tib')).toEqual('Tibetan');
  });

  it('resolves region and script variants to their language', () => {
    expect(getLanguageName('en-GB')).toEqual('English');
    expect(getLanguageName('zh-Hans')).toEqual('Chinese');
    expect(getLanguageName('pt_BR')).toEqual('Portuguese');
  });

  it('reports books without text', () => {
    expect(getLanguageName('zxx')).toEqual('No text');
  });

  it('ignores unknown codes so that a default can be used', () => {
    expect(getLanguageName(undefined)).toBeUndefined();
    expect(getLanguageName('')).toBeUndefined();
    expect(getLanguageName('und')).toBeUndefined();
    expect(getLanguageName('klingon')).toBeUndefined();
  });
});

describe('resolveLanguage', () => {
  it('returns nothing when no language is reported', () => {
    expect(resolveLanguage(undefined, 'English')).toBeUndefined();
    expect(resolveLanguage([], 'English')).toBeUndefined();
    expect(resolveLanguage(['und'], 'English')).toBeUndefined();
  });

  it('returns the only reported language', () => {
    expect(resolveLanguage(['eng'], 'English')).toEqual('English');
    expect(resolveLanguage(['jpn'], 'English')).toEqual('Japanese');
  });

  it('prefers the configured default language when it is reported', () => {
    expect(resolveLanguage(['eng', 'fre', 'ger'], 'English')).toEqual('English');
    expect(resolveLanguage(['fre', 'eng'], 'English')).toEqual('English');
    expect(resolveLanguage(['eng', 'fre'], 'French')).toEqual('French');
  });

  it('falls back to the first resolvable language', () => {
    expect(resolveLanguage(['spa', 'fre'], 'English')).toEqual('Spanish');
    expect(resolveLanguage(['und', 'fre'], 'English')).toEqual('French');
  });
});

describe('normalizeOnixProductForm', () => {
  it('maps physical bindings', () => {
    expect(normalizeOnixProductForm('BB')).toEqual('Hardcover');
    expect(normalizeOnixProductForm('BC')).toEqual('Paperback');
    expect(normalizeOnixProductForm('BH')).toEqual('Paperback');
  });

  it('ignores unknown and digital forms', () => {
    expect(normalizeOnixProductForm('EA')).toBeUndefined();
    expect(normalizeOnixProductForm(undefined)).toBeUndefined();
  });
});

describe('normalizeBookFormat', () => {
  it('maps paperback and hardcover descriptions', () => {
    expect(normalizeBookFormat('paperback')).toEqual('Paperback');
    expect(normalizeBookFormat('Softcover')).toEqual('Paperback');
    expect(normalizeBookFormat('Taschenbuch')).toEqual('Paperback');
    expect(normalizeBookFormat('hardcover')).toEqual('Hardcover');
    expect(normalizeBookFormat('Library binding')).toEqual('Hardcover');
  });

  it('maps comics before the binding they are printed in', () => {
    expect(normalizeBookFormat('tankobon softcover')).toEqual('Comic');
    expect(normalizeBookFormat('Graphic novel')).toEqual('Comic');
  });

  it('maps magazines', () => {
    expect(normalizeBookFormat('Magazine')).toEqual('Magazine');
  });

  it('ignores digital and audio editions', () => {
    expect(normalizeBookFormat('eBook')).toBeUndefined();
    expect(normalizeBookFormat('audio cd')).toBeUndefined();
    expect(normalizeBookFormat('Unknown Binding')).toBeUndefined();
    expect(normalizeBookFormat(undefined)).toBeUndefined();
  });
});

describe('resolveOpenLibraryMediaType', () => {
  it('reports comics even when the format says paperback', () => {
    expect(resolveOpenLibraryMediaType(['paperback'], ['Comics & Graphic Novels'])).toEqual('Comic');
    expect(resolveOpenLibraryMediaType(['tankobon softcover'], ['Manga'])).toEqual('Comic');
  });

  it('does not treat books about comics as comics', () => {
    expect(resolveOpenLibraryMediaType(['paperback'], ['Comic books, strips', 'Technique'])).toEqual('Paperback');
    expect(resolveOpenLibraryMediaType([], ['Cartooning', 'How to draw'])).toBeUndefined();
  });

  it('prefers magazines over the binding', () => {
    expect(resolveOpenLibraryMediaType(['paperback', 'Magazine'])).toEqual('Magazine');
  });

  it('prefers paperback over hardcover', () => {
    expect(resolveOpenLibraryMediaType(['hardcover', 'paperback'])).toEqual('Paperback');
  });

  it('returns nothing when no binding is reported', () => {
    expect(resolveOpenLibraryMediaType([], [])).toBeUndefined();
    expect(resolveOpenLibraryMediaType(undefined, undefined)).toBeUndefined();
    expect(resolveOpenLibraryMediaType(['eBook', 'audio cd'])).toBeUndefined();
  });
});

describe('resolveGoogleBooksMediaType', () => {
  it('detects magazines from the print type', () => {
    expect(resolveGoogleBooksMediaType('MAGAZINE', [])).toEqual('Magazine');
  });

  it('detects comics from the categories', () => {
    expect(resolveGoogleBooksMediaType('BOOK', ['Comics & Graphic Novels / Manga'])).toEqual('Comic');
  });

  it('returns nothing for ordinary books, which report no binding', () => {
    expect(resolveGoogleBooksMediaType('BOOK', ['Psychology / Creative Ability'])).toBeUndefined();
    expect(resolveGoogleBooksMediaType(undefined, undefined)).toBeUndefined();
  });
});

describe('isComicSeries', () => {
  it('detects Japanese comics labels', () => {
    expect(isComicSeries('少年サンデーコミックス')).toBe(true);
    expect(isComicSeries(['電撃コミックス'])).toBe(true);
    expect(isComicSeries('Shonen sunday comics special')).toBe(true);
  });

  it('ignores series that are not comics', () => {
    expect(isComicSeries('岩波新書')).toBe(false);
    expect(isComicSeries([''])).toBe(false);
    expect(isComicSeries(undefined)).toBe(false);
  });

  it('ignores guide books published under a comics imprint', () => {
    expect(isComicSeries('Manga time KR comics', 'TVアニメ公式ガイドブック')).toBe(false);
    expect(isComicSeries('角川コミックス・エース', 'How to Draw Manga')).toBe(false);
    expect(isComicSeries('角川コミックス・エース', '日常 1')).toBe(true);
  });
});

describe('DEFAULT_MEDIA_TYPE', () => {
  it('is a printable book', () => {
    expect(DEFAULT_MEDIA_TYPE).toEqual('Paperback');
  });
});
