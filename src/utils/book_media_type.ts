/** Media types that book notes are grouped by. */
export const MEDIA_TYPES = ['Paperback', 'Hardcover', 'Comic', 'Magazine'] as const;

export type MediaType = (typeof MEDIA_TYPES)[number];

/** Applied when a provider has no information about the binding of a book. */
export const DEFAULT_MEDIA_TYPE: MediaType = 'Paperback';

/**
 * ONIX code list 150 (`ProductForm`) values mapped to a media type. Forms that describe a
 * digital or audio product are intentionally absent so that the default applies to them.
 */
const ONIX_PRODUCT_FORMS: Record<string, MediaType> = {
  BB: 'Hardcover',
  BC: 'Paperback',
  BE: 'Paperback',
  BF: 'Paperback',
  BG: 'Hardcover',
  BH: 'Paperback',
  BI: 'Paperback',
  BJ: 'Paperback',
  BL: 'Paperback',
  BM: 'Paperback',
  BZ: 'Paperback',
};

/**
 * Patterns applied to free-text binding descriptions in order of specificity.
 *
 * Comic and magazine patterns run first so that a `graphic novel` hardcover is not reported as
 * a hardcover, and digital/audio formats are ignored because they say nothing about the binding.
 */
const FORMAT_PATTERNS: [RegExp, MediaType | undefined][] = [
  [/comic|manga|graphic novel|bande dessin|tankobon/i, 'Comic'],
  [/magazine|periodical|journal/i, 'Magazine'],
  [/hardcover|hardback|hard cover|hard back|library binding|gebundene|relié|cartonné/i, 'Hardcover'],
  [
    /paperback|paper back|softcover|soft cover|taschenbuch|broch|tapa blanda|pocket|mass market|oversized|broschur|brossura/i,
    'Paperback',
  ],
  [
    /ebook|e-book|electronic resource|audiobook|audio cd|mp3 cd|digital audio|kindle|microform|unknown binding/i,
    undefined,
  ],
];

/** Subject keywords that indicate a work is a comic, manga or graphic novel. */
const COMIC_SUBJECTS = ['comic', 'manga', 'graphic novel', 'bande dessin'];

/**
 * Subject keywords that also match non-comic books about comics, which are far more common than
 * the comics themselves in library catalogues.
 */
const NON_COMIC_SUBJECTS = [
  'technique',
  'how to draw',
  'cartooning',
  'authorship',
  'drawing',
  'illustration',
  'study & teaching',
  'history and criticism',
  'literary criticism',
  'criticism and interpretation',
  'caricature',
];

/**
 * Series name fragments that Japanese catalogues use for manga.
 *
 * Imprints are named after the magazine and label (`モーニングKC`, `MFCキューンシリーズ`,
 * `ビッグガンガンコミックス`, …), so the publisher abbreviations are matched on their own. They are
 * only matched at the start of a word, otherwise `KC` would hit the middle of Latin series names.
 */
const COMIC_SERIES = /コミック|アンソロジー|マンガ|漫画|まんが|comics?|comix|manga|(?<![A-Za-z])(?:KC|MFC)/i;

/**
 * Japanese title fragments of a book *about* a comic rather than the comic itself: guides, art
 * books and how-to-draw books are usually published under the same imprint as the series they
 * discuss.
 *
 * "Official" (`公式`) is deliberately absent: official anthologies and spin-off comics are comics,
 * while official guide books and art books already match one of the other fragments.
 */
const COMIC_REFERENCE_TITLE_JA =
  /ファンブック|ガイド|入門|描き方|描ける|画集|イラスト集|アートブック|ビジュアルブック|設定資料|設定集|資料集|素材集|ポストカード|カレンダー|ムック|図鑑|事典|大全|ノベライズ|写真集/i;

/**
 * English title fragments of a book *about* a comic.
 *
 * Comics routinely carry an English title as a parallel subtitle (`偽りのマリィゴールド = false
 * marigold`, `隣人さんはおせっかいお姉さん = The neighbor is a nosy older woman`), so these words are
 * only trusted in a title written entirely in Latin script. In a Japanese title they cannot be
 * told apart from a romanised subtitle, and letting one veto the imprint would drop a real comic,
 * which is the more expensive mistake: Art/guide books about a series are already recognisable
 * from their Japanese title, so this list only has to catch books that are wholly in English.
 *
 * The words are anchored, so a Latin subtitle such as `misguided` cannot trigger them.
 */
const COMIC_REFERENCE_TITLE_EN =
  /\b(?:guide ?book|guide|handbook|fan ?book|how to (?:draw|create|use)|mook|art ?book|visual ?book|novelisation|novelization)\b/i;

/** Whether the text contains any Japanese character, including half-width katakana. */
const JAPANESE_TEXT = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uff66-\uff9f]/;

/** ONIX code list 27 (`SubjectSchemeIdentifier`) value of the JPRO book code. */
const JPRO_SUBJECT_SCHEME = '78';

/**
 * A JPRO book code ends in a two digit content category, and `79` is the category publishers use
 * for comics. The leading digits describe the readership and the binding, so only the suffix is
 * checked: `C0079`, `C0979` and `C9979` are all comics.
 */
const COMIC_JPRO_CODE = /^\d{2}79$/;

/**
 * Folds half-width and full-width forms so that imprints spelled in half-width katakana
 * (`ﾋﾞｯｸﾞｶﾞﾝｶﾞﾝｺﾐｯｸｽ`) match the same patterns as their full-width spelling.
 */
function normalizeForMatch(text: string): string {
  return text.normalize('NFKC');
}

/**
 * ONIX subject entry, e.g. the JPRO book code Japanese publishers assign to a title.
 *
 * @see https://openbd.jp/spec/
 */
export interface OnixSubject {
  /** ONIX code list 27 value; `78` is the JPRO book code. */
  scheme?: string;
  /** Four digit JPRO book code such as `0079`. */
  code?: string;
}

function matchFormat(format: string): MediaType | undefined | null {
  for (const [pattern, mediaType] of FORMAT_PATTERNS) {
    if (pattern.test(format)) return mediaType;
  }
  return null;
}

/**
 * Converts an ONIX `ProductForm` code into a media type.
 *
 * @returns `undefined` when the code does not describe a physical binding.
 */
export function normalizeOnixProductForm(code?: string): MediaType | undefined {
  if (!code) return undefined;
  return ONIX_PRODUCT_FORMS[code.trim().toUpperCase()];
}

/**
 * Converts an Open Library `format` value into a media type.
 *
 * @returns `undefined` when the format describes a digital or audio edition, which carries no
 * information about the printed binding.
 */
export function normalizeBookFormat(format?: string): MediaType | undefined {
  if (!format) return undefined;
  return matchFormat(format) ?? undefined;
}

function isComicSubject(subjects: string[]): boolean {
  const lowered = subjects.map(subject => subject.toLowerCase());
  const hasComicSubject = lowered.some(subject => COMIC_SUBJECTS.some(marker => subject.includes(marker)));
  const hasNonComicSubject = lowered.some(subject => NON_COMIC_SUBJECTS.some(marker => subject.includes(marker)));
  return hasComicSubject && !hasNonComicSubject;
}

/**
 * Derives a media type from the free-text formats and subjects of an Open Library search result.
 *
 * Comics take precedence over everything else because Open Library reports `paperback` for most
 * comics, which would otherwise hide them. Beyond that, comic detection from subjects is only
 * trusted when no non-comic subject (such as `how to draw`) is present.
 */
export function resolveOpenLibraryMediaType(formats?: string[], subjects?: string[]): MediaType | undefined {
  for (const format of formats ?? []) {
    if (matchFormat(format) === 'Comic') return 'Comic';
  }

  if (subjects?.length && isComicSubject(subjects)) return 'Comic';

  for (const mediaType of ['Magazine', 'Paperback', 'Hardcover'] as const) {
    if ((formats ?? []).some(format => matchFormat(format) === mediaType)) return mediaType;
  }

  return undefined;
}

/**
 * Derives a media type from Google Books metadata.
 *
 * Google Books does not report a binding, so only magazines and comics can be identified.
 */
export function resolveGoogleBooksMediaType(printType?: string, categories?: string[]): MediaType | undefined {
  if (categories?.some(category => /^(comics?|graphic novels?|manga)/i.test(category.trim()))) return 'Comic';
  if (printType?.trim().toLowerCase() === 'magazine') return 'Magazine';
  return undefined;
}

/**
 * Detects manga from the series names that Japanese catalogues attribute to a book.
 *
 * OpenBD omits `ProductForm` for most titles, but manga are consistently part of a series whose
 * name contains a comics label (`コミックス`, `Shonen sunday comics special`, …). Guides and art
 * books that reuse such an imprint are excluded using their title.
 */
export function isComicSeries(series?: string | string[], title?: string): boolean {
  if (title && isComicReferenceTitle(title)) return false;
  const names = Array.isArray(series) ? series : [series];
  return names.some(name => !!name && COMIC_SERIES.test(normalizeForMatch(name)));
}

/**
 * Detects a book that is *about* comics rather than a comic.
 *
 * Japanese fragments are unambiguous and are always trusted. English fragments are only consulted
 * for titles without any Japanese text, because Japanese titles routinely end with an English
 * parallel title that a naive match would read as a book about comics.
 */
export function isComicReferenceTitle(title: string): boolean {
  const normalized = normalizeForMatch(title);
  if (COMIC_REFERENCE_TITLE_JA.test(normalized)) return true;
  return !JAPANESE_TEXT.test(normalized) && COMIC_REFERENCE_TITLE_EN.test(normalized);
}

/**
 * Detects the JPRO book code that Japanese publishers assign to comics.
 *
 * Indie publishers such as the one behind `9784910422275` report neither a comics imprint nor a
 * comic friendly `ProductFormDetail`, but they do report the content category, which is the most
 * direct statement a Japanese ONIX record can make about a title being a comic.
 */
export function isComicSubjectCode(subjects?: OnixSubject[]): boolean {
  return (subjects ?? []).some(
    subject => subject?.scheme?.trim() === JPRO_SUBJECT_SCHEME && COMIC_JPRO_CODE.test(subject?.code?.trim() ?? ''),
  );
}

/** Metadata of an OpenBD record that says something about whether it is a comic. */
export interface OpenBDMediaTypeInput {
  /** ONIX `ProductForm`, the binding of the book. */
  productForm?: string;
  /** Series names reported by the ONIX `Collection` and the OpenBD summary. */
  series?: (string | undefined)[];
  /** Volume label from the OpenBD summary, which sometimes carries the imprint (`447. YKコミックス`). */
  volume?: string;
  /** Title of the book, used to exclude guides and art books about a series. */
  title?: string;
  /** ONIX subjects, including the JPRO book code. */
  subjects?: OnixSubject[];
}

/**
 * Derives a media type from an OpenBD record.
 *
 * `ProductForm` is missing for most Japanese records, so the imprint is the main signal. The
 * volume label is checked as well because some publishers only report the imprint there, and the
 * JPRO book code covers publishers that use neither.
 */
export function resolveOpenBDMediaType({ productForm, series, volume, title, subjects }: OpenBDMediaTypeInput) {
  const binding = normalizeOnixProductForm(productForm);
  if (binding === 'Comic') return binding;

  const names = [...(series ?? []), volume].filter((name): name is string => Boolean(name));
  if (isComicSeries(names, title)) return 'Comic';
  if (isComicSubjectCode(subjects)) return 'Comic';

  return binding;
}
