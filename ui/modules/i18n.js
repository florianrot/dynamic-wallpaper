// AppShell — Internationalization (i18n)

let currentLocale = "en";
let translations = {};
const supportedLocales = ["en", "de"];

async function initI18n(configLocale) {
  const locale = configLocale === "system" ? detectSystemLocale() : configLocale;
  await loadLocale(supportedLocales.includes(locale) ? locale : "en");
}

async function loadLocale(locale) {
  try {
    const resp = await fetch(`./i18n/${locale}.json`);
    translations = await resp.json();
    currentLocale = locale;
    document.documentElement.lang = locale;
    applyTranslations();
  } catch (e) {
    if (locale !== "en") await loadLocale("en");
  }
}

function t(key, params) {
  let val = translations[key];
  if (val === undefined) return key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      val = val.replace(new RegExp(`\\{${k}\\}`, "g"), v);
    }
  }
  return val;
}

function applyTranslations() {
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  });
  document.querySelectorAll("[data-i18n-title]").forEach((el) => {
    el.title = t(el.dataset.i18nTitle);
  });
}

async function setLocale(locale) {
  config.locale = locale;
  const effective = locale === "system" ? detectSystemLocale() : locale;
  await loadLocale(supportedLocales.includes(effective) ? effective : "en");
  await api.save_config({ locale });
  if (typeof initCommandRegistry === "function") initCommandRegistry();
  showToast(t("toast.language_changed"), "success");
}

function detectSystemLocale() {
  const lang = (navigator.language || "en").split("-")[0];
  return supportedLocales.includes(lang) ? lang : "en";
}

function getLocale() {
  return currentLocale;
}
