import type { BookSearchPluginSettings } from '@settings/settings';
import { ServiceProvider } from '@src/constants';
import { ConfigurationError, factoryServiceProvider } from './base_api';
import { GoogleBooksApi } from './google_books_api';
import { NaverBooksApi } from './naver_books_api';
import { OpenBDBooksApi } from './openbd_books_api';
import { OpenLibraryBooksApi } from './openlibrary_books_api';

const settings = {
  serviceProvider: ServiceProvider.google,
  localePreference: 'default',
  enableCoverImageEdgeCurl: true,
  apiKey: '',
  naverClientId: '',
  naverClientSecret: '',
} as BookSearchPluginSettings;

const naverCredentials = { naverClientId: 'client-id', naverClientSecret: 'client-secret' };

describe('factoryServiceProvider', () => {
  it('uses the provider configured in the settings by default', () => {
    expect(factoryServiceProvider({ ...settings, serviceProvider: ServiceProvider.google })).toBeInstanceOf(
      GoogleBooksApi,
    );
    expect(factoryServiceProvider({ ...settings, serviceProvider: ServiceProvider.openlibrary })).toBeInstanceOf(
      OpenLibraryBooksApi,
    );
  });

  it('prefers the explicitly requested provider over the settings', () => {
    const api = factoryServiceProvider(
      { ...settings, serviceProvider: ServiceProvider.google },
      ServiceProvider.openlibrary,
    );
    expect(api).toBeInstanceOf(OpenLibraryBooksApi);
  });

  it('creates the Naver API when credentials are configured', () => {
    expect(factoryServiceProvider({ ...settings, ...naverCredentials }, ServiceProvider.naver)).toBeInstanceOf(
      NaverBooksApi,
    );
  });

  it('throws a ConfigurationError when Naver credentials are missing', () => {
    expect(() => factoryServiceProvider(settings, ServiceProvider.naver)).toThrow(ConfigurationError);
  });

  it('creates the OpenBD API', () => {
    expect(factoryServiceProvider(settings, ServiceProvider.openbd)).toBeInstanceOf(OpenBDBooksApi);
  });

  it('reports whether each provider supports ISBN search', () => {
    expect(factoryServiceProvider(settings, ServiceProvider.google).supportsIsbnSearch).toBe(true);
    expect(factoryServiceProvider(settings, ServiceProvider.openlibrary).supportsIsbnSearch).toBe(true);
    expect(factoryServiceProvider({ ...settings, ...naverCredentials }, ServiceProvider.naver).supportsIsbnSearch).toBe(
      false,
    );
    expect(factoryServiceProvider(settings, ServiceProvider.openbd).supportsIsbnSearch).toBe(true);
  });

  it('reports whether each provider supports text search', () => {
    expect(factoryServiceProvider(settings, ServiceProvider.google).supportsTextSearch).toBe(true);
    expect(factoryServiceProvider(settings, ServiceProvider.openlibrary).supportsTextSearch).toBe(true);
    expect(factoryServiceProvider({ ...settings, ...naverCredentials }, ServiceProvider.naver).supportsTextSearch).toBe(
      true,
    );
    expect(factoryServiceProvider(settings, ServiceProvider.openbd).supportsTextSearch).toBe(false);
  });
});
