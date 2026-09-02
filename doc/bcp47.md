## BCP47 

| Code | Language | Region |
| --- | --- | --- |
| **sq-AL** | Albanian | Albania |
| **am-ET** | Amharic | Ethiopia |
| **ar-SA** | Arabic | Saudi Arabia |
| **hy-AM** | Armenian | Armenia |
| **as-IN** | Assamese | India |
| **az-AZ** | Azerbaijani | Azerbaijan |
| **eu-ES** | Basque | Spain |
| **be-BY** | Belarusian | Belarus |
| **bn-IN** | Bengali | India |
| **bs-BA** | Bosnian | Bosnia and Herzegovina |
| **br-FR** | Breton | France |
| **bg-BG** | Bulgarian | Bulgaria |
| **my-MM** | Burmese | Myanmar |
| **ca-ES** | Catalan | Spain |
| **zh-CN** | Chinese | China |
| **zh-HK** | Chinese | Hong Kong |
| **zh-SG** | Chinese | Singapore |
| **zh-TW** | Chinese | Taiwan |
| **hr-HR** | Croatian | Croatia |
| **cs-CZ** | Czech | Czech Republic |
| **da-DK** | Danish | Denmark |
| **nl-BE** | Dutch | Belgium |
| **nl-NL** | Dutch | Netherlands |
| **dz-BT** | Dzongkha | Bhutan |
| **en-AU** | English | Australia |
| **en-CA** | English | Canada |
| **en-GB** | English | United Kingdom |
| **en-IE** | English | Ireland |
| **en-IN** | English | India |
| **en-NZ** | English | New Zealand |
| **en-US** | English | United States |
| **en-ZA** | English | South Africa |
| **et-EE** | Estonian | Estonia |
| **fo-FO** | Faroese | Faroe Islands |
| **fil-PH** | Filipino | Philippines |
| **fi-FI** | Finnish | Finland |
| **fr-BE** | French | Belgium |
| **fr-CA** | French | Canada |
| **fr-CH** | French | Switzerland |
| **fr-FR** | French | France |
| **gl-ES** | Galician | Spain |
| **ka-GE** | Georgian | Georgia |
| **de-AT** | German | Austria |
| **de-CH** | German | Switzerland |
| **de-DE** | German | Germany |
| **el-GR** | Greek | Greece |
| **gu-IN** | Gujarati | India |
| **ha-NG** | Hausa | Nigeria |
| **he-IL** | Hebrew | Israel |
| **hi-IN** | Hindi | India |
| **hu-HU** | Hungarian | Hungary |
| **is-IS** | Icelandic | Iceland |
| **ig-NG** | Igbo | Nigeria |
| **id-ID** | Indonesian | Indonesia |
| **ga-IE** | Irish | Ireland |
| **it-CH** | Italian | Switzerland |
| **it-IT** | Italian | Italy |
| **ja-JP** | Japanese | Japan |
| **jv-ID** | Javanese | Indonesia |
| **kn-IN** | Kannada | India |
| **kk-KZ** | Kazakh | Kazakhstan |
| **km-KH** | Khmer | Cambodia |
| **rw-RW** | Kinyarwanda | Rwanda |
| **ko-KR** | Korean | South Korea |
| **ky-KG** | Kyrgyz | Kyrgyzstan |
| **lo-LA** | Lao | Laos |
| **lv-LV** | Latvian | Latvia |
| **lt-LT** | Lithuanian | Lithuania |
| **lb-LU** | Luxembourgish | Luxembourg |
| **mk-MK** | Macedonian | North Macedonia |
| **ms-MY** | Malay | Malaysia |
| **ml-IN** | Malayalam | India |
| **mt-MT** | Maltese | Malta |
| **mi-NZ** | Maori | New Zealand |
| **mr-IN** | Marathi | India |
| **mn-MN** | Mongolian | Mongolia |
| **ne-NP** | Nepali | Nepal |
| **no-NO** | Norwegian | Norway |
| **nb-NO** | Norwegian Bokmål | Norway |
| **or-IN** | Odia (Oriya) | India |
| **ps-AF** | Pashto | Afghanistan |
| **fa-IR** | Persian | Iran |
| **pl-PL** | Polish | Poland |
| **pt-BR** | Portuguese | Brazil |
| **pt-PT** | Portuguese | Portugal |
| **pa-IN** | Punjabi | India |
| **ro-RO** | Romanian | Romania |
| **ru-RU** | Russian | Russia |
| **sm-WS** | Samoan | Samoa |
| **gd-GB** | Scottish Gaelic | United Kingdom |
| **sr-RS** | Serbian | Serbia |
| **sd-PK** | Sindhi | Pakistan |
| **si-LK** | Sinhala | Sri Lanka |
| **sk-SK** | Slovak | Slovakia |
| **sl-SI** | Slovenian | Slovenia |
| **so-SO** | Somali | Somalia |
| **st-ZA** | Southern Sotho | South Africa |
| **es-AR** | Spanish | Argentina |
| **es-CL** | Spanish | Chile |
| **es-CO** | Spanish | Colombia |
| **es-ES** | Spanish | Spain |
| **es-MX** | Spanish | Mexico |
| **es-PE** | Spanish | Peru |
| **sw-KE** | Swahili | Kenya |
| **sv-FI** | Swedish | Finland |
| **sv-SE** | Swedish | Sweden |
| **tg-TJ** | Tajik | Tajikistan |
| **ta-IN** | Tamil | India |
| **tt-RU** | Tatar | Russia |
| **te-IN** | Telugu | India |
| **th-TH** | Thai | Thailand |
| **bo-CN** | Tibetan | China |
| **ti-ET** | Tigrinya | Ethiopia |
| **to-TO** | Tongan | Tonga |
| **tn-ZA** | Tswana | South Africa |
| **tk-TM** | Turkmen | Turkmenistan |
| **tr-TR** | Turkish | Turkey |
| **uk-UA** | Ukrainian | Ukraine |
| **ur-PK** | Urdu | Pakistan |
| **uz-UZ** | Uzbek | Uzbekistan |
| **vi-VN** | Vietnamese | Vietnam |
| **cy-GB** | Welsh | United Kingdom |
| **fy-NL** | Western Frisian | Netherlands |
| **xh-ZA** | Xhosa | South Africa |
| **yo-NG** | Yoruba | Nigeria |
| **zu-ZA** | Zulu | South Africa |

### Methodological Notes

* **Construction Methodology:** This list was compiled by expanding a base set of common BCP 47 language tags through cross-referencing with Google Chrome's native internationalization capabilities (via the V8 engine and ICU library). To maintain strict structural consistency across the dataset, a filtering rule was applied to retain only standard `Language-Region` (xx-XX) formats. Standalone language codes (e.g., `en`, `fr`) and macro-region tags (e.g., `es-419`) were deliberately excluded from the final table, even though they are natively supported by the browser's `Intl` APIs.
* **Data Sources:** The primary authoritative sources used to validate and expand this list include the official Google Chrome Extensions API documentation for `chrome.i18n` supported locales, the Google Workspace Admin Directory API language code registry, and the Common Locale Data Repository (CLDR) mappings that dictate Chromium's underlying ICU (International Components for Unicode) implementation.
