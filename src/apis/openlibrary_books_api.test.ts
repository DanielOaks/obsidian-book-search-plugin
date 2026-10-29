import { OpenLibraryBookItem } from './models/openlibrary_books_response';
import { OpenLibraryBooksApi } from './openlibrary_books_api';

jest.mock('./base_api', () => ({
  ...jest.requireActual('./base_api'),
  apiGet: jest.fn(),
}));

const { apiGet } = jest.requireMock('./base_api') as { apiGet: jest.Mock };

function createApi(docs: OpenLibraryBookItem[], defaultLanguage = 'English') {
  apiGet.mockResolvedValue({ numFound: docs.length, start: 0, docs });
  return new OpenLibraryBooksApi(defaultLanguage);
}

const item: OpenLibraryBookItem = {
  title: 'Flow',
  author_name: ['Mihaly Csikszentmihalyi'],
  isbn: ['0061876720', '9780061876721'],
  number_of_pages_median: 336,
  publish_date: ['2009-10-13'],
  publisher: ['Harper Collins'],
  language: ['eng'],
  format: ['Paperback'],
  subject: ['Psychology', 'Happiness'],
};

describe('OpenLibraryBooksApi', () => {
  beforeEach(() => {
    apiGet.mockReset();
  });

  it('requests the language, format and subject fields', async () => {
    const api = createApi([item]);
    await api.getByQuery('flow', 'text');

    const [, params] = apiGet.mock.calls[0] as [string, { fields: string }];
    expect(params.fields).toContain('language');
    expect(params.fields).toContain('format');
    expect(params.fields).toContain('subject');
  });

  it('maps the reported language and format', async () => {
    const [book] = await createApi([item]).getByQuery('flow', 'text');
    expect(book.languages).toEqual('English');
    expect(book.mediaType).toEqual('Paperback');
  });

  it('prefers the configured default language of a multi-language record', async () => {
    const [defaultEnglish] = await createApi([{ ...item, language: ['fre', 'eng'] }]).getByQuery('flow', 'text');
    expect(defaultEnglish.languages).toEqual('English');

    const [defaultFrench] = await createApi([{ ...item, language: ['fre', 'eng'] }], 'French').getByQuery(
      'flow',
      'text',
    );
    expect(defaultFrench.languages).toEqual('French');
  });

  it('leaves the language unset when nothing is reported', async () => {
    const [book] = await createApi([{ ...item, language: undefined }]).getByQuery('flow', 'text');
    expect(book.languages).toBeUndefined();
  });

  it('detects comics from the subjects', async () => {
    const [book] = await createApi([{ ...item, subject: ['Comics & Graphic Novels', 'Manga'] }]).getByQuery(
      'flow',
      'text',
    );
    expect(book.mediaType).toEqual('Comic');
  });

  it('leaves the media type unset when no binding is reported', async () => {
    const [book] = await createApi([{ ...item, format: undefined }]).getByQuery('flow', 'text');
    expect(book.mediaType).toBeUndefined();
  });
});
