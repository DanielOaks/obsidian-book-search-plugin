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

/** Series name fragments that Japanese catalogues use for manga. */
const COMIC_SERIES = /コミックス|comics|manga|アンソロジー/i;

/**
 * Title fragments of a book *about* a comic rather than the comic itself: guides, art books and
 * how-to-draw books are usually published under the same imprint as the series they discuss.
 */
const COMIC_REFERENCE_TITLE =
  /guide ?book|guide|handbook|fan ?book|how to (draw|create|use)|ガイド|入門|描き方|描ける|公式/i;

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
  if (title && COMIC_REFERENCE_TITLE.test(title)) return false;
  const names = Array.isArray(series) ? series : [series];
  return names.some(name => !!name && COMIC_SERIES.test(name));
}
