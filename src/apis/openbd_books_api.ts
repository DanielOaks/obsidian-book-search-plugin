import { Book } from '@models/book.model';
import { getLanguageName, JAPANESE_LANGUAGE } from '@utils/book_languages';
import { isComicSeries, MediaType, normalizeOnixProductForm } from '@utils/book_media_type';
import { apiGet, BaseBooksApiImpl } from './base_api';
import { OpenBDBookItem, OpenBDBooksResponse } from './models/openbd_books_response';

const OPENBD_ENDPOINT = 'https://api.openbd.jp/v1/get';
const ISBN_REGEX = /^(97(8|9))?\d{9}(\d|X)$/;

// ONIX code list values used by OpenBD
const EXTENT_TYPE_PAGES = '11';
const PUBLISHING_DATE_ROLE_PUBLICATION = '01';
const TEXT_TYPE_DESCRIPTION = '03';
const TEXT_TYPE_SHORT_DESCRIPTION = '02';
const RESOURCE_CONTENT_TYPE_FRONT_COVER = '01';

function first<T>(value?: T | T[]): T | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function normalizeName(name?: string): string {
  return name?.replace(/\u3000/g, ' ').trim() ?? '';
}

function formatDate(date?: string): string {
  const digits = date?.replace(/\D/g, '') ?? '';
  if (digits.length >= 8) return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
  if (digits.length >= 6) return `${digits.slice(0, 4)}-${digits.slice(4, 6)}`;
  return digits.slice(0, 4);
}

// https://openbd.jp/spec/
export class OpenBDBooksApi implements BaseBooksApiImpl {
  readonly supportsTextSearch = false;
  readonly supportsIsbnSearch = true;

  async getByQuery(query: string, searchType: string): Promise<Book[]> {
    if (searchType !== 'isbn') {
      throw new Error('OpenBD only supports searching by ISBN.');
    }

    const isbn = OpenBDBooksApi.normalizeIsbn(query);
    if (!ISBN_REGEX.test(isbn)) {
      throw new Error(`"${query}" is not a valid ISBN.`);
    }

    try {
      const searchResults = await apiGet<OpenBDBooksResponse>(OPENBD_ENDPOINT, { isbn });
      // OpenBD returns [null] for ISBNs it does not know about
      return (searchResults ?? [])
        .filter((item): item is OpenBDBookItem => Boolean(item?.onix || item?.summary))
        .map(item => this.createBookItem(item));
    } catch (error) {
      console.warn(error);
      throw error;
    }
  }

  /** Strips hyphens/spaces and converts full-width characters so "978-4-7808-0204-7" works. */
  static normalizeIsbn(isbn: string): string {
    return isbn
      .replace(/[０-９ａ-ｚＡ-Ｚ]/g, char => String.fromCharCode(char.charCodeAt(0) - 0xfee0))
      .replace(/[^0-9xX]/g, '')
      .toUpperCase();
  }

  createBookItem(item: OpenBDBookItem): Book {
    const { onix, summary } = item;
    const titleElement = first(onix?.DescriptiveDetail?.TitleDetail?.TitleElement);
    const authors = this.extractAuthors(item);
    const isbn = summary?.isbn || onix?.RecordReference || onix?.ProductIdentifier?.IDValue || '';

    return {
      title: summary?.title || titleElement?.TitleText?.content || '',
      subtitle: titleElement?.Subtitle?.content ?? '',
      author: authors.join(', '),
      authors,
      publisher:
        summary?.publisher ||
        onix?.PublishingDetail?.Publisher?.PublisherName ||
        onix?.PublishingDetail?.Imprint?.ImprintName ||
        '',
      publishDate: this.extractPublishDate(item),
      totalPage: this.extractTotalPage(item),
      languages: this.extractLanguage(item),
      mediaType: this.extractMediaType(item),
      coverUrl: summary?.cover || this.extractCoverUrl(item),
      description: this.extractDescription(item),
      isbn,
      ...(isbn.length >= 13 ? { isbn13: isbn } : { isbn10: isbn }),
    };
  }

  private extractAuthors(item: OpenBDBookItem): string[] {
    const contributors = item.onix?.DescriptiveDetail?.Contributor ?? [];
    const names = contributors.map(contributor => normalizeName(contributor.PersonName?.content)).filter(Boolean);
    if (names.length) return names;

    const fallback = normalizeName(item.summary?.author);
    return fallback ? [fallback] : [];
  }

  private extractPublishDate(item: OpenBDBookItem): string {
    const dates = item.onix?.PublishingDetail?.PublishingDate ?? [];
    const publicationDate = dates.find(date => date.PublishingDateRole === PUBLISHING_DATE_ROLE_PUBLICATION)?.Date;
    return formatDate(item.summary?.pubdate || publicationDate || item.hanmoto?.dateshuppan);
  }

  private extractTotalPage(item: OpenBDBookItem): number | undefined {
    const extents = item.onix?.DescriptiveDetail?.Extent ?? [];
    const pages = extents.find(extent => extent.ExtentType === EXTENT_TYPE_PAGES);
    const value = Number(pages?.ExtentValue);
    return Number.isFinite(value) && value > 0 ? value : undefined;
  }

  private extractCoverUrl(item: OpenBDBookItem): string {
    const resources = item.onix?.CollateralDetail?.SupportingResource ?? [];
    const frontCover =
      resources.find(resource => resource.ResourceContentType === RESOURCE_CONTENT_TYPE_FRONT_COVER) ?? resources[0];
    return (frontCover?.ResourceVersion ?? []).find(version => version.ResourceLink)?.ResourceLink ?? '';
  }

  private extractDescription(item: OpenBDBookItem): string {
    const contents = item.onix?.CollateralDetail?.TextContent ?? [];
    const pick = (textType: string) => contents.find(content => content.TextType === textType)?.Text;
    return pick(TEXT_TYPE_DESCRIPTION) || pick(TEXT_TYPE_SHORT_DESCRIPTION) || item.hanmoto?.kaisetsu105w || '';
  }

  private extractLanguage(item: OpenBDBookItem): string {
    const codes = (item.onix?.DescriptiveDetail?.Language ?? [])
      .map(language => language.LanguageCode)
      .filter((code): code is string => Boolean(code));
    return codes.map(getLanguageName).find((name): name is string => Boolean(name)) ?? JAPANESE_LANGUAGE;
  }

  private extractMediaType(item: OpenBDBookItem): MediaType | undefined {
    const descriptiveDetail = item.onix?.DescriptiveDetail;
    const productForm = normalizeOnixProductForm(descriptiveDetail?.ProductForm);
    if (productForm === 'Comic') return productForm;

    const titleElements = descriptiveDetail?.Collection?.TitleDetail?.TitleElement;
    const collectionTitles = (Array.isArray(titleElements) ? titleElements : [titleElements])
      .map(element => element?.TitleText?.content)
      .filter((title): title is string => Boolean(title));
    if (isComicSeries([...collectionTitles, item.summary?.series ?? ''], item.summary?.title)) return 'Comic';

    return productForm;
  }
}
