import { ServiceProvider } from '@src/constants';
import { getLanguageName, getProviderDefaultLanguage, resolveLanguage } from './book_languages';
import {
  DEFAULT_MEDIA_TYPE,
  isComicReferenceTitle,
  isComicSeries,
  isComicSubjectCode,
  normalizeBookFormat,
  normalizeOnixProductForm,
  resolveGoogleBooksMediaType,
  resolveOpenBDMediaType,
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

describe('getProviderDefaultLanguage', () => {
  it('uses the language the provider is bound to', () => {
    expect(getProviderDefaultLanguage(ServiceProvider.naver, 'English')).toEqual('Korean');
    expect(getProviderDefaultLanguage(ServiceProvider.openbd, 'English')).toEqual('Japanese');
  });

  it('uses the configured default language for global providers', () => {
    expect(getProviderDefaultLanguage(ServiceProvider.google, 'French')).toEqual('French');
    expect(getProviderDefaultLanguage(ServiceProvider.openlibrary, 'German')).toEqual('German');
  });

  it('falls back to English when no default is configured', () => {
    expect(getProviderDefaultLanguage(ServiceProvider.google)).toEqual('English');
    expect(getProviderDefaultLanguage(ServiceProvider.openlibrary, '  ')).toEqual('English');
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

  it('detects comics imprints abbreviated to the publisher label', () => {
    expect(isComicSeries('モーニングKC')).toBe(true);
    expect(isComicSeries('ヤンマガKCスペシャル')).toBe(true);
    expect(isComicSeries('BE LOVE KC')).toBe(true);
    expect(isComicSeries('KCx')).toBe(true);
    expect(isComicSeries('MFCキューンシリーズ')).toBe(true);
    expect(isComicSeries('HARTA COMIX')).toBe(true);
  });

  it('does not read the labels out of unrelated Latin words', () => {
    expect(isComicSeries('Backcountry')).toBe(false);
    expect(isComicSeries('AMFChoir')).toBe(false);
  });

  it('folds half-width katakana before matching', () => {
    expect(isComicSeries('ﾋﾞｯｸﾞｶﾞﾝｶﾞﾝｺﾐｯｸｽ')).toBe(true);
    expect(isComicSeries('ｶﾞﾝｶﾞﾝｺﾐｯｸｽUP！')).toBe(true);
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

  it('ignores art books, mooks and novelizations published under a comics imprint', () => {
    expect(isComicSeries('ジャンプ・コミックス', 'ONE PIECE 画集')).toBe(false);
    expect(isComicSeries('ジャンプ・コミックス', 'ONE PIECE 公式ファンブック')).toBe(false);
    expect(isComicSeries('モーニングKC', '七つの大罪 設定資料集')).toBe(false);
    expect(isComicSeries('角川コミックス・エース', '艦これ ノベライズ')).toBe(false);
  });

  it('keeps official anthologies, which are comics', () => {
    expect(isComicSeries('あすかコミックスDX', 'おそ松さん公式アンソロジーコミック')).toBe(true);
  });

  it('keeps comics whose Japanese title carries an English parallel title', () => {
    expect(isComicSeries('MFCキューンシリーズ', '偽りのマリィゴールド = false marigold. 1')).toBe(true);
    expect(isComicSeries('コミック', '隣人さんはおせっかいお姉さん = The neighbor is a nosy older woman. 1')).toBe(
      true,
    );
    expect(isComicSeries('HARTA COMIX', '山を渡る : 三多摩大岳部録. 1')).toBe(true);
  });

  it('does not let an English word in a Japanese title veto the imprint', () => {
    expect(isComicSeries('ジャンプ・コミックス', 'ワンピース : a guide to the new world. 1')).toBe(true);
    expect(isComicSeries('モーニングKC', '進撃の巨人 = attack on titan handbook. 2')).toBe(true);
    expect(isComicSeries('MFCキューンシリーズ', '偽りのマリィゴールド = a fan book of marigold. 3')).toBe(true);
  });

  it('still ignores English guide books and art books without Japanese title text', () => {
    expect(isComicSeries('Manga time KR comics', 'How to Draw Manga')).toBe(false);
    expect(isComicSeries('Scream comics', 'A Guide Book to the Galaxy')).toBe(false);
    expect(isComicSeries('Scream comics', 'The Handbook of Nothing')).toBe(false);
  });
});

describe('isComicReferenceTitle', () => {
  it('detects Japanese fragments of books about comics', () => {
    expect(isComicReferenceTitle('ONE PIECE 画集')).toBe(true);
    expect(isComicReferenceTitle('TVアニメ公式ガイドブック')).toBe(true);
    expect(isComicReferenceTitle('七つの大罪 設定資料集')).toBe(true);
  });

  it('only trusts Latin fragments in titles without Japanese text', () => {
    expect(isComicReferenceTitle('How to Draw Manga')).toBe(true);
    expect(isComicReferenceTitle('A Guide Book to the Galaxy')).toBe(true);
    expect(isComicReferenceTitle('隣人さんはおせっかいお姉さん = The neighbor is a nosy older woman. 1')).toBe(false);
    expect(isComicReferenceTitle('偽りのマリィゴールド = false marigold. 1')).toBe(false);
  });

  it('anchors the Latin fragments so substrings of a subtitle do not match', () => {
    expect(isComicReferenceTitle('Misguided')).toBe(false);
    expect(isComicReferenceTitle('Mooka')).toBe(false);
  });
});

describe('isComicSubjectCode', () => {
  it('detects the JPRO comic content category whatever the readership and binding', () => {
    expect(isComicSubjectCode([{ scheme: '78', code: '0079' }])).toBe(true);
    expect(isComicSubjectCode([{ scheme: '78', code: '0979' }])).toBe(true);
    expect(isComicSubjectCode([{ scheme: '78', code: '9979' }])).toBe(true);
  });

  it('ignores other JPRO categories', () => {
    expect(isComicSubjectCode([{ scheme: '78', code: '0039' }])).toBe(false);
    expect(isComicSubjectCode([{ scheme: '78', code: '0139' }])).toBe(false);
    expect(isComicSubjectCode([{ scheme: '78', code: '3039' }])).toBe(false);
  });

  it('ignores comic codes from other subject schemes', () => {
    expect(isComicSubjectCode([{ scheme: '93', code: '0079' }])).toBe(false);
    expect(isComicSubjectCode([{ scheme: '78' }])).toBe(false);
    expect(isComicSubjectCode(undefined)).toBe(false);
  });
});

describe('resolveOpenBDMediaType', () => {
  it('prefers an explicit comic product form', () => {
    expect(resolveOpenBDMediaType({ productForm: 'BC', series: ['モーニングKC'] })).toEqual('Comic');
  });

  it('falls back to the series names collected by the caller', () => {
    expect(resolveOpenBDMediaType({ series: ['', 'モーニングKC'] })).toEqual('Comic');
    expect(resolveOpenBDMediaType({ series: ['ＭＦＣキューンシリーズ'] })).toEqual('Comic');
  });

  it('reads the imprint from the volume label when the series is empty', () => {
    expect(resolveOpenBDMediaType({ series: [''], volume: '447. YKコミックス' })).toEqual('Comic');
  });

  it('falls back to the JPRO comic category', () => {
    expect(resolveOpenBDMediaType({ productForm: 'BA', subjects: [{ scheme: '78', code: '0079' }] })).toEqual('Comic');
  });

  it('keeps the binding for records that are not comics', () => {
    expect(resolveOpenBDMediaType({ productForm: 'BC', series: ['岩波文庫'] })).toEqual('Paperback');
    expect(resolveOpenBDMediaType({ productForm: 'BA', subjects: [{ scheme: '78', code: '0039' }] })).toEqual(
      undefined,
    );
    expect(resolveOpenBDMediaType({})).toBeUndefined();
  });

  it('does not let a guide book under a comics imprint override its binding', () => {
    expect(
      resolveOpenBDMediaType({
        productForm: 'BC',
        series: ['Manga time KR comics'],
        title: 'ぼっち・ざ・ろっく!TVアニメ公式ガイドブック',
      }),
    ).toEqual('Paperback');
  });
});

describe('DEFAULT_MEDIA_TYPE', () => {
  it('is a printable book', () => {
    expect(DEFAULT_MEDIA_TYPE).toEqual('Paperback');
  });
});
