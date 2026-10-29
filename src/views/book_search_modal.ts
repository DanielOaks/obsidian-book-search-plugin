import { BaseBooksApiImpl, factoryServiceProvider } from '@apis/base_api';
import { Book } from '@models/book.model';
import { DEFAULT_SETTINGS } from '@settings/settings';
import { SEARCH_TYPE_LABELS, SearchType, ServiceProvider, toSearchType } from '@src/constants';
import BookSearchPlugin from '@src/main';
import { getProviderDefaultLanguage } from '@utils/book_languages';
import { DEFAULT_MEDIA_TYPE } from '@utils/book_media_type';
import languages from '@utils/languages';
import { ButtonComponent, DropdownComponent, Modal, Notice, TextComponent } from 'obsidian';

const SERVICE_PROVIDER_LABELS: Record<ServiceProvider, string> = {
  [ServiceProvider.google]: 'Google Books (Global)',
  [ServiceProvider.openlibrary]: 'Open Library (Global)',
  [ServiceProvider.naver]: 'Naver (Korean)',
  [ServiceProvider.openbd]: 'OpenBD (Japanese)',
};

export class BookSearchModal extends Modal {
  private readonly SEARCH_BUTTON_TEXT = 'Search';
  private readonly REQUESTING_BUTTON_TEXT = 'Requesting...';
  private readonly EMPTY_BOOK_BUTTON_TEXT = 'Create empty book';
  private isBusy = false;
  private okBtnRef?: ButtonComponent;
  private emptyBookBtnRef?: ButtonComponent;
  private messageEl?: HTMLElement;
  private booksApi: BaseBooksApiImpl;
  private selectedProvider: ServiceProvider;
  private options: { locale: string };
  private providerSettingsEl?: HTMLElement;
  private searchTypeDropdown?: DropdownComponent;
  private queryInput?: TextComponent;
  private searchType: SearchType;

  constructor(
    private plugin: BookSearchPlugin,
    private query: string,
    searchType: string,
    private callback: (error: Error | null, result?: Book[], manualEntry?: boolean) => void,
    provider: ServiceProvider = plugin.settings.serviceProvider ?? ServiceProvider.google,
  ) {
    super(plugin.app);
    this.options = { locale: plugin.settings.localePreference };
    this.searchType = toSearchType(searchType || plugin.settings.defaultSearchType);
    this.selectedProvider = provider;
    if (!this.switchProvider(provider) && provider !== ServiceProvider.google)
      this.switchProvider(ServiceProvider.google);
  }

  private switchProvider(provider: ServiceProvider): boolean {
    try {
      this.booksApi = factoryServiceProvider(this.plugin.settings, provider);
      this.selectedProvider = provider;
      return true;
    } catch (error) {
      new Notice((error as Error)?.message ?? String(error));
      return false;
    }
  }

  private onProviderChange(provider: ServiceProvider, dropdown: DropdownComponent): void {
    if (!this.switchProvider(provider)) return void dropdown.setValue(this.selectedProvider);
    this.renderProviderSettings();
    this.updateSearchTypeOptions();
  }

  setBusy(busy: boolean): void {
    this.isBusy = busy;
    this.okBtnRef?.setDisabled(busy).setButtonText(busy ? this.REQUESTING_BUTTON_TEXT : this.SEARCH_BUTTON_TEXT);
    this.emptyBookBtnRef?.setDisabled(busy);
  }

  private showMessage(message: string): void {
    if (!this.messageEl) return void new Notice(message);
    this.messageEl.setText(message);
    this.messageEl.removeClass('book-search-plugin__hide');
  }

  private clearMessage(): void {
    this.messageEl?.setText('');
    this.messageEl?.addClass('book-search-plugin__hide');
  }

  async searchBook(): Promise<void> {
    if (this.isBusy) return;

    this.clearMessage();
    if (!this.query.trim()) return void this.showMessage('Enter a query to search for a book.');

    this.setBusy(true);
    try {
      const searchResults = await this.booksApi.getByQuery(this.query, this.searchType, this.options);
      console.log(searchResults);
      if (!searchResults?.length) {
        // Keeping the modal open lets the user create an empty book note instead
        return void this.showMessage(`No results found for "${this.query}". Create an empty book instead?`);
      }
      this.callback(null, searchResults);
      this.close();
    } catch (err) {
      this.callback(err as Error);
      this.close();
    } finally {
      this.setBusy(false);
    }
  }

  /**
   * Resolves the search modal with an empty book, for titles that no provider knows about.
   *
   * Only the values that can be derived locally are filled in: the language comes from the
   * selected provider and the media type from the plugin default.
   */
  createEmptyBook(): void {
    if (this.isBusy) return;

    const book: Book = {
      title: '',
      subtitle: '',
      author: '',
      authors: [],
      category: '',
      categories: [],
      publisher: '',
      publishDate: '',
      totalPage: '',
      languages: getProviderDefaultLanguage(this.selectedProvider, this.plugin.settings.defaultLanguage),
      mediaType: DEFAULT_MEDIA_TYPE,
      coverUrl: '',
      coverSmallUrl: '',
      coverMediumUrl: '',
      coverLargeUrl: '',
      isbn10: '',
      isbn13: '',
      isbn: '',
      link: '',
      description: '',
      previewLink: '',
    };

    this.callback(null, [book], true);
    this.close();
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.addClass('book-search-plugin__search-modal');
    contentEl.createEl('h2', { text: 'Search Book' });

    const providerDropdown = new DropdownComponent(this.addRow(contentEl, 'API'));
    Object.entries(SERVICE_PROVIDER_LABELS).forEach(([provider, label]) => providerDropdown.addOption(provider, label));
    providerDropdown
      .setValue(this.selectedProvider)
      .onChange(value => this.onProviderChange(value as ServiceProvider, providerDropdown));

    this.providerSettingsEl = contentEl.createDiv();
    this.renderProviderSettings();

    const searchBarEl = contentEl.createDiv({ cls: 'book-search-plugin__search-modal--search-bar' });
    this.queryInput = new TextComponent(
      searchBarEl.createDiv({ cls: 'book-search-plugin__search-modal--search-input' }),
    )
      .setValue(this.query)
      .setPlaceholder('Search text')
      .onChange(value => (this.query = value));
    this.queryInput.inputEl.addEventListener(
      'keydown',
      event => event.key === 'Enter' && !event.isComposing && this.searchBook(),
    );

    this.searchTypeDropdown = new DropdownComponent(
      searchBarEl.createDiv({ cls: 'book-search-plugin__search-modal--search-type' }),
    )
      .addOption(SearchType.text, SEARCH_TYPE_LABELS[SearchType.text])
      .addOption(SearchType.isbn, SEARCH_TYPE_LABELS[SearchType.isbn])
      .setValue(this.searchType)
      .onChange(value => (this.searchType = toSearchType(value)));
    this.updateSearchTypeOptions();

    this.messageEl = contentEl.createDiv({ cls: 'book-search-plugin__search-modal--message book-search-plugin__hide' });

    const buttonEl = contentEl.createDiv({ cls: 'book-search-plugin__search-modal--button' });
    this.emptyBookBtnRef = new ButtonComponent(buttonEl)
      .setButtonText(this.EMPTY_BOOK_BUTTON_TEXT)
      .setTooltip('Skip the search and create an empty book note')
      .onClick(() => this.createEmptyBook());
    this.okBtnRef = new ButtonComponent(buttonEl)
      .setButtonText(this.SEARCH_BUTTON_TEXT)
      .setCta()
      .onClick(() => this.searchBook());
  }

  private addRow(containerEl: HTMLElement, label: string): HTMLElement {
    const rowEl = containerEl.createDiv({ cls: 'book-search-plugin__search-modal--row' });
    rowEl.createDiv({ cls: 'book-search-plugin__search-modal--row-label', text: label });
    return rowEl.createDiv({ cls: 'book-search-plugin__search-modal--row-control' });
  }

  private renderProviderSettings(): void {
    if (!this.providerSettingsEl) return;
    this.providerSettingsEl.empty();
    if (this.selectedProvider === ServiceProvider.google && this.plugin.settings.askForLocale)
      this.renderSelectLocale(this.providerSettingsEl);
  }

  private updateSearchTypeOptions(): void {
    const dropdown = this.searchTypeDropdown;
    if (!dropdown) return;

    const supportsIsbn = this.booksApi.supportsIsbnSearch;
    const supportsText = this.booksApi.supportsTextSearch;
    const setOptionDisabled = (value: SearchType, disabled: boolean) => {
      const option = dropdown.selectEl.querySelector<HTMLOptionElement>(`option[value="${value}"]`);
      if (option) option.disabled = disabled;
    };
    setOptionDisabled(SearchType.isbn, !supportsIsbn);
    setOptionDisabled(SearchType.text, !supportsText);

    if (!supportsIsbn && this.searchType === SearchType.isbn) this.searchType = SearchType.text;
    if (!supportsText && this.searchType === SearchType.text) this.searchType = SearchType.isbn;
    dropdown.setValue(this.searchType);
    this.queryInput?.setPlaceholder(supportsText ? 'Search text' : 'Search ISBN (hyphens optional)');
  }

  renderSelectLocale(containerEl: HTMLElement = this.contentEl) {
    const defaultLocale = window.moment.locale();
    const dropdown = new DropdownComponent(this.addRow(containerEl, 'Locale'));
    dropdown.addOption(defaultLocale, `${languages[defaultLocale] || defaultLocale}`);
    window.moment.locales().forEach(locale => {
      const localeName = languages[locale];
      if (localeName && locale !== defaultLocale) dropdown.addOption(locale, localeName);
    });
    dropdown
      .setValue(this.options.locale === DEFAULT_SETTINGS.localePreference ? defaultLocale : this.options.locale)
      .onChange(locale => (this.options.locale = locale));
  }

  onClose(): void {
    const { contentEl } = this;
    contentEl.empty();
  }
}
