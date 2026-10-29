import { NaverBookItem } from './models/naver_books_response';
import { NaverBooksApi } from './naver_books_api';

describe('NaverBooksApi', () => {
  const api = new NaverBooksApi('client-id', 'client-secret');

  const item: NaverBookItem = {
    title: '아몬드',
    link: 'https://search.naver.com/search.naver?where=book&isbn=9788936434267',
    image: 'https://shopping-phinf.pstatic.net/main_3243625/32436253723.20220518073821.jpg',
    author: '손원평',
    discount: '12600',
    publisher: '다즐링',
    pubdate: '20230420',
    isbn: '9788936434267',
    description: '“왜 그렇게 사는 거야?”',
  };

  const book = api.createBookItem(item);

  it('creates a book from search response', () => {
    expect(book.title).toEqual('아몬드');
    expect(book.author).toEqual('손원평');
    expect(book.publisher).toEqual('다즐링');
    expect(book.coverUrl).toEqual(item.image);
    expect(book.publishDate).toEqual('2023');
    expect(book.link).toEqual(item.link);
    expect(book.description).toEqual(item.description);
  });

  it('ISBN', () => {
    expect(book.isbn).toEqual('9788936434267');
    expect(book.isbn13).toEqual('9788936434267');
    expect(book.isbn10).toBeUndefined();
  });

  it('defaults to Korean since Naver reports no language', () => {
    expect(book.languages).toEqual('Korean');
  });

  it('leaves the media type to the default since Naver reports no format', () => {
    expect(book.mediaType).toBeUndefined();
  });
});
