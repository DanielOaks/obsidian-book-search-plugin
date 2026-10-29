import { BaseBooksApiImpl, factoryServiceProvider } from '@apis/base_api';
import { Book } from '@models/book.model';
import { DEFAULT_SETTINGS } from '@settings/settings';
import { SEARCH_TYPE_LABELS, SearchType, ServiceProvider, toSearchType } from '@src/constants';
import BookSearchPlugin from '@src/main';
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
  private isBusy = false;
  private okBtnRef?: ButtonComponent;
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
    private callback: (error: Error | null, result?: Book[]) => void,
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
  }

  async searchBook(): Promise<void> {
    if (!this.query) return void new Notice('No query entered.');
    if (this.isBusy) return;

    this.setBusy(true);
    try {
      const searchResults = await this.booksApi.getByQuery(this.query, this.searchType, this.options);
      console.log(searchResults);
      if (!searchResults?.length) return void new Notice(`No results found for "${this.query}" as ${this.searchType}`);
      this.callback(null, searchResults);
    } catch (err) {
      this.callback(err as Error);
    } finally {
      this.setBusy(false);
      this.close();
    }
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

    const buttonEl = contentEl.createDiv({ cls: 'book-search-plugin__search-modal--button' });
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
