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

  it('detects manga recorded under a half-width katakana imprint', () => {
    const manga = api.createBookItem({
      summary: { title: '薬屋のひとりごと外伝 小蘭回想録 1', series: 'ﾋﾞｯｸﾞｶﾞﾝｶﾞﾝｺﾐｯｸｽ' },
    });
    expect(manga.mediaType).toEqual('Comic');
  });

  it('detects manga from imprints abbreviated to the publisher label', () => {
    for (const series of ['モーニングKC', 'MFCキューンシリーズ', 'HARTA COMIX', 'ヤンマガKCスペシャル']) {
      expect(api.createBookItem({ summary: { title: 'ある漫画 1', series } }).mediaType).toEqual('Comic');
    }
  });

  it('detects manga from the imprint in the volume label', () => {
    const manga = api.createBookItem({
      summary: { title: '隣人さんはおせっかいお姉さん 1', series: 'コミック', volume: '447. YKコミックス' },
    });
    expect(manga.mediaType).toEqual('Comic');
  });

  it('detects manga from the JPRO comic content category', () => {
    const manga = api.createBookItem({
      onix: {
        DescriptiveDetail: { ProductForm: 'BA', Subject: [{ SubjectSchemeIdentifier: '78', SubjectCode: '0079' }] },
      },
      summary: { title: 'グッバイ・ハロー・ワールド 増補改訂版' },
    });
    expect(manga.mediaType).toEqual('Comic');
  });

  it('does not detect manga from a non-comic JPRO content category', () => {
    const novel = api.createBookItem({
      onix: {
        DescriptiveDetail: { ProductForm: 'BC', Subject: [{ SubjectSchemeIdentifier: '78', SubjectCode: '0039' }] },
      },
      summary: { title: 'こころ', series: '岩波文庫' },
    });
    expect(novel.mediaType).toEqual('Paperback');
  });

  it('does not detect manga from art books, mooks and novelizations', () => {
    const cases = [
      { title: 'ONE PIECE 画集', series: 'ジャンプ・コミックス' },
      { title: 'ONE PIECE 公式ファンブック', series: 'ジャンプ・コミックス' },
      { title: '七つの大罪 設定資料集', series: 'モーニングKC' },
      { title: '艦これ ノベライズ', series: '角川コミックス・エース' },
      { title: '京都さんぽ 写真集', series: 'コミック' },
    ];
    for (const summary of cases) {
      expect(api.createBookItem({ summary }).mediaType).toBeUndefined();
    }
  });

  it('detects manga that carry an English parallel title', () => {
    const cases = [
      { title: '偽りのマリィゴールド = false marigold. 1', series: 'MFCキューンシリーズ' },
      { title: '隣人さんはおせっかいお姉さん = The neighbor is a nosy older woman. 1', series: 'YKコミックス' },
    ];
    for (const summary of cases) {
      expect(api.createBookItem({ summary }).mediaType).toEqual('Comic');
    }
  });

  it('does not detect manga from an art book titled entirely in English', () => {
    const artBook = api.createBookItem({ summary: { title: 'ONE PIECE Art Book', series: 'ジャンプ・コミックス' } });
    expect(artBook.mediaType).toBeUndefined();
  });

  it('detects the comics that OpenBD reports without a comic product form', () => {
    // Trimmed records: only the fields that carry the comic signal are kept.
    const records: (OpenBDBookItem & { summary: { isbn: string } })[] = [
      {
        summary: {
          isbn: '9784301001959',
          title: '薬屋のひとりごと外伝 小蘭回想録 1',
          series: 'ﾋﾞｯｸﾞｶﾞﾝｶﾞﾝｺﾐｯｸｽ',
          volume: '',
        },
      },
      { summary: { isbn: '9784065285398', title: 'R15+じゃダメですか? 1', series: 'モーニングKC', volume: '' } },
      {
        summary: { isbn: '9784046826961', title: '偽りのマリィゴールド 1', series: 'MFCキューンシリーズ', volume: '' },
      },
      {
        summary: { isbn: '9784046832078', title: '偽りのマリィゴールド 2', series: 'MFCキューンシリーズ', volume: '' },
      },
      {
        summary: { isbn: '9784046837356', title: '偽りのマリィゴールド 3', series: 'MFCキューンシリーズ', volume: '' },
      },
      { summary: { isbn: '9784047353343', title: '山を渡る 三多摩大岳部録 1', series: 'HARTA COMIX', volume: '' } },
      {
        onix: {
          DescriptiveDetail: { ProductForm: 'BA', Subject: [{ SubjectSchemeIdentifier: '78', SubjectCode: '0079' }] },
        },
        summary: { isbn: '9784910422275', title: 'グッバイ・ハロー・ワールド 増補改訂版', series: '', volume: '' },
      },
      { summary: { isbn: '9784301001287', title: '玉川さん 出てました? 2', series: 'ﾔﾝｸﾞｶﾞﾝｶﾞﾝｺﾐｯｸｽ', volume: '' } },
      { summary: { isbn: '9784301003410', title: '玉川さん 出てました? 3', series: 'ﾔﾝｸﾞｶﾞﾝｶﾞﾝｺﾐｯｸｽ', volume: '' } },
      { summary: { isbn: '9784301005957', title: '玉川さん 出てました? 4', series: 'ﾔﾝｸﾞｶﾞﾝｶﾞﾝｺﾐｯｸｽ', volume: '' } },
      {
        summary: {
          isbn: '9784785973995',
          title: '隣人さんはおせっかいお姉さん 1',
          series: 'コミック',
          volume: '447. YKコミックス',
        },
      },
    ];

    for (const record of records) {
      expect([record.summary.isbn, api.createBookItem(record).mediaType]).toEqual([record.summary.isbn, 'Comic']);
    }
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
