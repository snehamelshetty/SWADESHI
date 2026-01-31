// i18n.js — tiny runtime to apply translations in DOM
(function(){
  function t(key, lang){
    if (!window.TRANSLATIONS) return key;
    lang = lang || (window.i18n && window.i18n.lang) || localStorage.getItem('site-lang') || (navigator.language || 'en').slice(0,2);
    const obj = window.TRANSLATIONS[lang] || window.TRANSLATIONS['en'];
    return key.split('.').reduce((o,k)=> o && o[k], obj) || key;
  }

  function applyTranslations(lang){
    if (!lang) lang = localStorage.getItem('site-lang') || (navigator.language || 'en').slice(0,2);
    if (!window.TRANSLATIONS[lang]) lang = 'en';
    window.i18n = window.i18n || {};
    window.i18n.lang = lang;
    window.i18n.t = (k) => t(k, lang);

    // set lang attribute
    document.documentElement.lang = lang;

    // text content
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      const val = t(key, lang);
      // If element is INPUT/TEXTAREA and has placeholder attribute, set placeholder
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
        el.placeholder = val;
      } else {
        el.textContent = val;
      }
    });

    // attributes (data-i18n-placeholder, data-i18n-value, data-i18n-title, data-i18n-aria)
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el=>{
      const key = el.getAttribute('data-i18n-placeholder');
      el.placeholder = t(key, lang);
    });
    document.querySelectorAll('[data-i18n-title]').forEach(el=>{
      const key = el.getAttribute('data-i18n-title');
      el.title = t(key, lang);
    });
    document.querySelectorAll('[data-i18n-aria]').forEach(el=>{
      const key = el.getAttribute('data-i18n-aria');
      el.setAttribute('aria-label', t(key, lang));
    });

    // Translate inputs' value if data-i18n-value provided
    document.querySelectorAll('[data-i18n-value]').forEach(el=>{
      const key = el.getAttribute('data-i18n-value');
      el.value = t(key, lang);
    });
  }

  function init(){
    // populate lang selector if present
    const sel = document.getElementById('lang-select');
    const saved = localStorage.getItem('site-lang') || (navigator.language||'en').slice(0,2);
    if (sel) {
      sel.value = saved;
      sel.addEventListener('change', (e)=>{
        localStorage.setItem('site-lang', e.target.value);
        applyTranslations(e.target.value);
      });
    }
    applyTranslations(saved);
  }

  // Expose helper
  window.i18n = window.i18n || {};
  window.i18n.t = window.i18n.t || ((k)=> t(k));
  window.i18n.applyTranslations = applyTranslations;

  document.addEventListener('DOMContentLoaded', init);
})();
