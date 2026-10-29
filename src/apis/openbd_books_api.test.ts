import { Book } from '@models/book.model';
import { OpenBDBookItem } from './models/openbd_books_response';
import { OpenBDBooksApi } from './openbd_books_api';

describe('OpenBDBooksApi', () => {
  const api = new OpenBDBooksApi();

  const item: OpenBDBookItem = {
    onix: {
      RecordReference: '9784780802047',
      NotificationType: '03',
      ProductIdentifier: { ProductIDType: '15', IDValue: '9784780802047' },
      DescriptiveDetail: {
        TitleDetail: {
          TitleElement: {
            TitleElementLevel: '01',
            TitleText: { collationkey: 'オニギリレシピイチマルイチ', content: 'おにぎりレシピ101' },
            Subtitle: { content: 'EVERYDAY ONIGIRI 101' },
          },
        },
        Contributor: [
          { SequenceNumber: '1', ContributorRole: ['A01'], PersonName: { content: '山田　玲子' } },
          { SequenceNumber: '2', ContributorRole: ['A01'], PersonName: { content: '水野　菜生' } },
        ],
        Extent: [{ ExtentType: '11', ExtentValue: '126', ExtentUnit: '03' }],
      },
      CollateralDetail: {
        TextContent: [
          { TextType: '02', ContentAudience: '00', Text: 'short description' },
          { TextType: '03', ContentAudience: '00', Text: 'full description' },
        ],
        SupportingResource: [
          {
            ResourceContentType: '01',
            ResourceMode: '03',
            ResourceVersion: [{ ResourceForm: '02', ResourceLink: 'https://cover.openbd.jp/9784780802047.jpg' }],
          },
        ],
      },
      PublishingDetail: {
        Imprint: { ImprintName: 'ポット出版' },
        Publisher: { PublisherName: 'ポット出版' },
        PublishingDate: [
          { PublishingDateRole: '01', Date: '20140408' },
          { PublishingDateRole: '25', Date: '20140326' },
        ],
      },
    },
    hanmoto: { dateshuppan: '2014-04' },
    summary: {
      isbn: '9784780802047',
      title: 'おにぎりレシピ101',
      publisher: 'ポット出版',
      pubdate: '20140408',
      cover: 'https://cover.openbd.jp/9784780802047.jpg',
      author: '山田玲子／著 水野菜生／英訳',
    },
  };

  const book: Book = api.createBookItem(item);

  it('Title', () => {
    expect(book.title).toEqual('おにぎりレシピ101');
  });

  it('Subtitle', () => {
    expect(book.subtitle).toEqual('EVERYDAY ONIGIRI 101');
  });

  it('Authors', () => {
    expect(book.authors).toEqual(['山田 玲子', '水野 菜生']);
    expect(book.author).toEqual('山田 玲子, 水野 菜生');
  });

  it('Publisher', () => {
    expect(book.publisher).toEqual('ポット出版');
  });

  it('PublishDate', () => {
    expect(book.publishDate).toEqual('2014-04-08');
  });

  it('TotalPage', () => {
    expect(book.totalPage).toEqual(126);
  });

  it('CoverUrl', () => {
    expect(book.coverUrl).toEqual('https://cover.openbd.jp/9784780802047.jpg');
  });

  it('Description', () => {
    expect(book.description).toEqual('full description');
  });

  it('ISBN', () => {
    expect(book.isbn).toEqual('9784780802047');
    expect(book.isbn13).toEqual('9784780802047');
    expect(book.isbn10).toBeUndefined();
  });

  it('defaults to Japanese when ONIX omits the language', () => {
    expect(book.languages).toEqual('Japanese');
  });

  it('reads the language from the ONIX record', () => {
    const japanese = api.createBookItem({
      onix: { DescriptiveDetail: { Language: [{ LanguageRole: '01', LanguageCode: 'jpn' }] } },
    });
    expect(japanese.languages).toEqual('Japanese');

    const english = api.createBookItem({
      onix: { DescriptiveDetail: { Language: [{ LanguageRole: '01', LanguageCode: 'eng' }] } },
    });
    expect(english.languages).toEqual('English');
  });

  it('leaves the media type to the default for books without a product form', () => {
    expect(book.mediaType).toBeUndefined();
  });

  it('reads the media type from the ONIX product form', () => {
    const hardcover = api.createBookItem({ onix: { DescriptiveDetail: { ProductForm: 'BB' } } });
    expect(hardcover.mediaType).toEqual('Hardcover');

    const paperback = api.createBookItem({ onix: { DescriptiveDetail: { ProductForm: 'BC' } } });
    expect(paperback.mediaType).toEqual('Paperback');
  });

  it('detects manga from the collection title', () => {
    const manga = api.createBookItem({
      onix: {
        DescriptiveDetail: {
          ProductForm: 'BC',
          Collection: {
            CollectionType: '10',
            TitleDetail: {
              TitleType: '01',
              TitleElement: { TitleElementLevel: '02', TitleText: { content: '少年サンデーコミックス' } },
            },
          },
        },
      },
    });
    expect(manga.mediaType).toEqual('Comic');
  });

  it('detects manga from the summary series', () => {
    const manga = api.createBookItem({
      onix: { DescriptiveDetail: { ProductForm: 'BC' } },
      summary: { title: 'ワンピース 1', series: 'ジャンプ・コミックス' },
    });
    expect(manga.mediaType).toEqual('Comic');
  });

  it('does not detect manga from an unrelated series', () => {
    const novel = api.createBookItem({
      onix: { DescriptiveDetail: { ProductForm: 'BC' } },
      summary: { title: 'こころ', series: '岩波文庫' },
    });
    expect(novel.mediaType).toEqual('Paperback');
  });

  it('does not detect manga from a guide book published under a comics imprint', () => {
    const guide = api.createBookItem({
      onix: { DescriptiveDetail: { ProductForm: 'BC' } },
      summary: { title: 'ぼっち・ざ・ろっく!TVアニメ公式ガイドブック', series: 'Manga time KR comics' },
    });
    expect(guide.mediaType).toEqual('Paperback');
  });

  it('falls back to hanmoto when the summary is missing', () => {
    const fallback = api.createBookItem({ hanmoto: { dateshuppan: '2014-04', kaisetsu105w: 'hanmoto description' } });
    expect(fallback.title).toEqual('');
    expect(fallback.publishDate).toEqual('2014-04');
    expect(fallback.description).toEqual('hanmoto description');
    expect(fallback.authors).toEqual([]);
  });

  it('normalizes hyphenated and full-width ISBNs', () => {
    expect(OpenBDBooksApi.normalizeIsbn('978-4-7808-0204-7')).toEqual('9784780802047');
    expect(OpenBDBooksApi.normalizeIsbn('９７８４７８０８０２０４７')).toEqual('9784780802047');
  });

  it('rejects text queries', async () => {
    await expect(api.getByQuery('おにぎり', 'text')).rejects.toThrow('OpenBD only supports searching by ISBN.');
  });

  it('rejects invalid ISBNs', async () => {
    await expect(api.getByQuery('not-an-isbn', 'isbn')).rejects.toThrow('is not a valid ISBN');
  });
});
