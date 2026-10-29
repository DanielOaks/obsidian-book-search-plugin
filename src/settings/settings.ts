import { replaceDateInString } from '@utils/utils';
import { App, DropdownComponent, Notice, PluginSettingTab, Setting } from 'obsidian';

import { SEARCH_TYPE_LABELS, SearchType, ServiceProvider } from '@src/constants';
import languages from '@utils/languages';
import { LANGUAGE_NAMES, NO_TEXT_LANGUAGE } from '@utils/book_languages';
import { SettingServiceProviderModal } from '@views/setting_service_provider_modal';
import BookSearchPlugin from '../main';
import { FileNameFormatSuggest } from './suggesters/FileNameFormatSuggester';
import { FileSuggest } from './suggesters/FileSuggester';
import { FolderSuggest } from './suggesters/FolderSuggester';

const docUrl = 'https://github.com/anpigon/obsidian-book-search-plugin';

// Service providers that only support one search type force it in the settings.
const FORCED_SEARCH_TYPES: Partial<Record<ServiceProvider, SearchType>> = {
  [ServiceProvider.naver]: SearchType.text,
  [ServiceProvider.openbd]: SearchType.isbn,
};

export enum DefaultFrontmatterKeyType {
  snakeCase = 'Snake Case',
  camelCase = 'Camel Case',
}

export interface BookSearchPluginSettings {
  folder: string; // new file location
  fileNameFormat: string; // new file name format
  frontmatter: string; // frontmatter that is inserted into the file
  content: string; // what is automatically written to the file.
  useDefaultFrontmatter: boolean;
  defaultFrontmatterKeyType: DefaultFrontmatterKeyType;
  templateFile: string;
  serviceProvider: ServiceProvider;
  defaultSearchType: SearchType;
  naverClientId: string;
  naverClientSecret: string;
  localePreference: string;
  defaultLanguage: string;
  apiKey: string;
  openPageOnCompletion: boolean;
  showCoverImageInSearch: boolean;
  enableCoverImageSave: boolean;
  enableCoverImageEdgeCurl: boolean;
  coverImagePath: string;
  askForLocale: boolean;
}

export const DEFAULT_SETTINGS: BookSearchPluginSettings = {
  folder: '',
  fileNameFormat: '',
  frontmatter: '',
  content: '',
  useDefaultFrontmatter: true,
  defaultFrontmatterKeyType: DefaultFrontmatterKeyType.camelCase,
  templateFile: '',
  serviceProvider: ServiceProvider.google,
  defaultSearchType: SearchType.text,
  naverClientId: '',
  naverClientSecret: '',
  localePreference: 'default',
  defaultLanguage: 'English',
  apiKey: '',
  openPageOnCompletion: true,
  showCoverImageInSearch: false,
  enableCoverImageSave: false,
  enableCoverImageEdgeCurl: true,
  coverImagePath: '',
  askForLocale: true,
};

export class BookSearchSettingTab extends PluginSettingTab {
  constructor(
    app: App,
    private plugin: BookSearchPlugin,
  ) {
    super(app, plugin);
  }

  private createGeneralSettings(containerEl) {
    this.createHeader('General Settings', containerEl);
    this.createFileLocationSetting(containerEl);
    this.createFileNameFormatSetting(containerEl);
  }

  private createHeader(title, containerEl) {
    const header = document.createDocumentFragment();
    header.createEl('h2', { text: title });
    return new Setting(containerEl).setHeading().setName(header);
  }

  private createFileLocationSetting(containerEl) {
    new Setting(containerEl)
      .setName('New file location')
      .setDesc('New book notes will be placed here.')
      .addSearch(cb => {
        try {
          new FolderSuggest(this.app, cb.inputEl);
        } catch (e) {
          console.error(e); // Improved error handling
        }
        cb.setPlaceholder('Example: folder1/folder2')
          .setValue(this.plugin.settings.folder)
          .onChange(new_folder => {
            this.plugin.settings.folder = new_folder;
            this.plugin.saveSettings();
          });
      });
  }

  private createFileNameFormatSetting(containerEl) {
    const newFileNameHint = document.createDocumentFragment().createEl('code', {
      text: replaceDateInString(this.plugin.settings.fileNameFormat) || '{{title}} - {{author}}',
    });
    new Setting(containerEl)
      .setClass('book-search-plugin__settings--new_file_name')
      .setName('New file name')
      .setDesc('Enter the file name format.')
      .addSearch(cb => {
        try {
          new FileNameFormatSuggest(this.app, cb.inputEl);
        } catch (e) {
          console.error(e); // Improved error handling
        }
        cb.setPlaceholder('Example: {{title}} - {{author}}')
          .setValue(this.plugin.settings.fileNameFormat)
          .onChange(newValue => {
            this.plugin.settings.fileNameFormat = newValue?.trim();
            this.plugin.saveSettings();

            newFileNameHint.innerHTML = replaceDateInString(newValue) || '{{title}} - {{author}}';
          });
      });
    containerEl
      .createEl('div', {
        cls: ['setting-item-description', 'book-search-plugin__settings--new_file_name_hint'],
      })
      .append(newFileNameHint);
  }

  private createTemplateFileSetting(containerEl: HTMLElement) {
    const templateFileDesc = document.createDocumentFragment();
    templateFileDesc.createDiv({ text: 'Files will be available as templates.' });
    templateFileDesc.createEl('a', {
      text: 'Example Template',
      href: `${docUrl}#example-template`,
    });
    new Setting(containerEl)
      .setName('Template file')
      .setDesc(templateFileDesc)
      .addSearch(cb => {
        try {
          new FileSuggest(this.app, cb.inputEl);
        } catch {
          // eslint-disable
        }
        cb.setPlaceholder('Example: templates/template-file')
          .setValue(this.plugin.settings.templateFile)
          .onChange(newTemplateFile => {
            this.plugin.settings.templateFile = newTemplateFile;
            this.plugin.saveSettings();
          });
      });
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.classList.add('book-search-plugin__settings');

    this.createGeneralSettings(containerEl);
    this.createTemplateFileSetting(containerEl);

    // Service Provider
    let serviceProviderExtraSettingButton: HTMLElement;
    // eslint-disable-next-line prefer-const
    let preferredLocaleDropdownSetting: Setting;
    // eslint-disable-next-line prefer-const
    let coverImageEdgeCurlToggleSetting: Setting;
    let defaultSearchTypeDropdown: DropdownComponent | undefined;
    const hideServiceProviderExtraSettingButton = () => {
      serviceProviderExtraSettingButton.addClass('book-search-plugin__hide');
    };
    const showServiceProviderExtraSettingButton = () => {
      serviceProviderExtraSettingButton.removeClass('book-search-plugin__hide');
    };
    const hideServiceProviderExtraSettingDropdown = () => {
      if (preferredLocaleDropdownSetting !== undefined) {
        preferredLocaleDropdownSetting.settingEl.addClass('book-search-plugin__hide');
      }
    };
    const showServiceProviderExtraSettingDropdown = () => {
      if (preferredLocaleDropdownSetting !== undefined) {
        preferredLocaleDropdownSetting.settingEl.removeClass('book-search-plugin__hide');
      }
    };
    const hideCoverImageEdgeCurlToggle = () => {
      if (coverImageEdgeCurlToggleSetting !== undefined) {
        coverImageEdgeCurlToggleSetting.settingEl.addClass('book-search-plugin__hide');
      }
    };
    const showCoverImageEdgeCurlToggle = () => {
      if (coverImageEdgeCurlToggleSetting !== undefined) {
        coverImageEdgeCurlToggleSetting.settingEl.removeClass('book-search-plugin__hide');
      }
    };

    const toggleServiceProviderExtraSettings = (
      serviceProvider: ServiceProvider = this.plugin.settings?.serviceProvider,
    ) => {
      const forcedSearchType = FORCED_SEARCH_TYPES[serviceProvider];
      if (serviceProvider === ServiceProvider.naver) {
        showServiceProviderExtraSettingButton();
        hideServiceProviderExtraSettingDropdown();
        hideCoverImageEdgeCurlToggle();
      } else if (serviceProvider === ServiceProvider.openbd) {
        hideServiceProviderExtraSettingButton();
        hideServiceProviderExtraSettingDropdown();
        hideCoverImageEdgeCurlToggle();
      } else {
        hideServiceProviderExtraSettingButton();
        showServiceProviderExtraSettingDropdown();
        showCoverImageEdgeCurlToggle();
      }
      if (forcedSearchType) {
        defaultSearchTypeDropdown?.setDisabled(true).setValue(forcedSearchType);
      } else {
        defaultSearchTypeDropdown
          ?.setDisabled(false)
          .setValue(this.plugin.settings.defaultSearchType ?? SearchType.text);
      }
    };
    new Setting(containerEl)
      .setName('Service Provider')
      .setDesc('Choose the service provider you want to use to search your books.')
      .setClass('book-search-plugin__settings--service_provider')
      .addDropdown(dropDown => {
        dropDown.addOption(ServiceProvider.google, `${ServiceProvider.google} (Global)`);
        dropDown.addOption(ServiceProvider.openlibrary, `${ServiceProvider.openlibrary} (Global)`);
        dropDown.addOption(ServiceProvider.naver, `${ServiceProvider.naver} (Korean)`);
        dropDown.addOption(ServiceProvider.openbd, `${ServiceProvider.openbd} (Japanese)`);
        dropDown.setValue(this.plugin.settings?.serviceProvider ?? ServiceProvider.google);
        dropDown.onChange(async value => {
          const newValue = value as ServiceProvider;
          toggleServiceProviderExtraSettings(newValue);
          this.plugin.settings['serviceProvider'] = newValue;
          await this.plugin.saveSettings();
        });
      })
      .addExtraButton(component => {
        serviceProviderExtraSettingButton = component.extraSettingsEl;
        toggleServiceProviderExtraSettings();
        component.onClick(() => {
          new SettingServiceProviderModal(this.plugin).open();
        });
      });

    const getForcedSearchType = () => FORCED_SEARCH_TYPES[this.plugin.settings?.serviceProvider];

    new Setting(containerEl)
      .setName('Default search type')
      .setDesc('Choose the default search type, Text or ISBN.')
      .addDropdown(dropDown => {
        defaultSearchTypeDropdown = dropDown;
        Object.entries(SEARCH_TYPE_LABELS).forEach(([value, label]) => dropDown.addOption(value, label));
        const forcedSearchType = getForcedSearchType();
        if (forcedSearchType) dropDown.setDisabled(true).setValue(forcedSearchType);
        else dropDown.setValue(this.plugin.settings.defaultSearchType ?? SearchType.text);
        dropDown.onChange(async value => {
          this.plugin.settings.defaultSearchType = value as SearchType;
          await this.plugin.saveSettings();
        });
      });

    preferredLocaleDropdownSetting = new Setting(containerEl)
      .setName('Preferred locale')
      .setDesc('Sets the preferred locale to use when searching for books.')
      .addDropdown(dropDown => {
        const defaultLocale = window.moment.locale();
        dropDown.addOption(defaultLocale, `${languages[defaultLocale] || defaultLocale} (Default Locale)`);
        window.moment.locales().forEach(locale => {
          const localeName = languages[locale];
          if (localeName && locale !== defaultLocale) dropDown.addOption(locale, localeName);
        });
        const localeValue = this.plugin.settings.localePreference;
        dropDown
          .setValue(localeValue === DEFAULT_SETTINGS.localePreference ? defaultLocale : localeValue)
          .onChange(async value => {
            const newValue = value;
            this.plugin.settings.localePreference = newValue;
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName('Default language')
      .setDesc('Used for the {{languages}} variable when the book metadata does not report a language.')
      .addDropdown(dropDown => {
        Object.values(LANGUAGE_NAMES)
          .sort((a, b) => a.localeCompare(b))
          .forEach(language => dropDown.addOption(language, language));
        dropDown.addOption(NO_TEXT_LANGUAGE, NO_TEXT_LANGUAGE);
        dropDown.setValue(this.plugin.settings.defaultLanguage ?? DEFAULT_SETTINGS.defaultLanguage);
        dropDown.onChange(async value => {
          this.plugin.settings.defaultLanguage = value;
          await this.plugin.saveSettings();
        });
      });

    new Setting(containerEl)
      .setName('Open New Book Note')
      .setDesc('Enable or disable the automatic opening of the note on creation.')
      .addToggle(toggle =>
        toggle.setValue(this.plugin.settings.openPageOnCompletion).onChange(async value => {
          this.plugin.settings.openPageOnCompletion = value;
          await this.plugin.saveSettings();
        }),
      );

    new Setting(containerEl)
      .setName('Show Cover Images in Search')
      .setDesc('Toggle to show or hide cover images in the search results.')
      .addToggle(toggle =>
        toggle.setValue(this.plugin.settings.showCoverImageInSearch).onChange(async value => {
          this.plugin.settings.showCoverImageInSearch = value;
          await this.plugin.saveSettings();
        }),
      );

    // A toggle whether or not to ask for the locale every time a search is made
    new Setting(containerEl)
      .setName('Ask for Locale')
      .setDesc('Toggle to enable or disable asking for the locale every time a search is made.')
      .addToggle(toggle =>
        toggle.setValue(this.plugin.settings.askForLocale).onChange(async value => {
          this.plugin.settings.askForLocale = value;
          await this.plugin.saveSettings();
        }),
      );

    coverImageEdgeCurlToggleSetting = new Setting(containerEl)
      .setName('Enable Cover Image Edge Curl Effect')
      .setDesc('Toggle to show or hide page curl effect in cover images.')
      .addToggle(toggle =>
        toggle.setValue(this.plugin.settings.enableCoverImageEdgeCurl).onChange(async value => {
          this.plugin.settings.enableCoverImageEdgeCurl = value;
          await this.plugin.saveSettings();
        }),
      );

    new Setting(containerEl)
      .setName('Enable Cover Image Save')
      .setDesc('Toggle to enable or disable saving cover images in notes.')
      .addToggle(toggle =>
        toggle.setValue(this.plugin.settings.enableCoverImageSave).onChange(async value => {
          this.plugin.settings.enableCoverImageSave = value;
          await this.plugin.saveSettings();
        }),
      );

    new Setting(containerEl)
      .setName('Cover Image Path')
      .setDesc('Specify the path where cover images should be saved.')
      .addSearch(cb => {
        try {
          new FolderSuggest(this.app, cb.inputEl);
        } catch {
          // eslint-disable
        }
        cb.setPlaceholder('Enter the path (e.g., Images/Covers)')
          .setValue(this.plugin.settings.coverImagePath)
          .onChange(async value => {
            this.plugin.settings.coverImagePath = value.trim();
            await this.plugin.saveSettings();
          });
      });

    // Google API Settings
    this.createHeader('Google API Settings', containerEl);
    new Setting(containerEl)
      .setName('Description About Google API Settings')
      .setDesc(
        '**WARNING** please use this field after you must understand Google Cloud API, such as API key security.',
      );

    new Setting(containerEl)
      .setName('Status Check')
      .setDesc('check whether API key is saved. It does not guarantee that the API key is valid or invalid.')
      .addButton(button => {
        button.setButtonText('API Check').onClick(async () => {
          if (this.plugin.settings.apiKey.length) {
            new Notice('API key exist.');
          } else {
            new Notice('API key does not exist.');
          }
        });
      });

    const googleAPISetDesc = document.createDocumentFragment();
    googleAPISetDesc.createDiv({ text: 'Set your Books API key.' });
    googleAPISetDesc.createDiv({
      text: 'For security reason, saved API key is not shown in this textarea after saved.',
    });
    let tempKeyValue = '';
    new Setting(containerEl)
      .setName('Set API Key')
      .setDesc(googleAPISetDesc)
      .addText(text => {
        text.inputEl.type = 'password';
        text.setValue('').onChange(async value => {
          tempKeyValue = value;
        });
      })
      .addButton(button => {
        button.setButtonText('Save Key').onClick(async () => {
          this.plugin.settings.apiKey = tempKeyValue;
          await this.plugin.saveSettings();
          new Notice('API key Saved');
        });
      });
  }
}
