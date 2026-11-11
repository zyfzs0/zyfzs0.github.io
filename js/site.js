(() => {
  'use strict';

  const button = document.getElementById('lang-btn');
  const buttonText = document.getElementById('lang-btn-text');
  let currentLanguage = 'en';

  function setLanguage(language) {
    currentLanguage = language === 'zh' ? 'zh' : 'en';
    const chinese = currentLanguage === 'zh';
    document.body.classList.toggle('zh', chinese);
    document.documentElement.lang = chinese ? 'zh-CN' : 'en';
    buttonText.textContent = chinese ? 'English' : '中文';
    buttonText.lang = chinese ? 'en' : 'zh-CN';
    button.setAttribute('aria-label', chinese ? 'Switch to English' : '切换为中文');
    document.querySelector('.site-nav').setAttribute('aria-label', chinese ? '主导航' : 'Main navigation');
    document.querySelector('.profile').setAttribute('aria-label', chinese ? '个人信息与联系方式' : 'Profile and contact information');
    updateActiveSection();
    document.dispatchEvent(new CustomEvent('languagechange', { detail: { language: currentLanguage } }));
  }

  try {
    setLanguage(localStorage.getItem('lang'));
  } catch {
    setLanguage('en');
  }
  button.hidden = false;
  button.addEventListener('click', () => {
    setLanguage(currentLanguage === 'en' ? 'zh' : 'en');
    try {
      localStorage.setItem('lang', currentLanguage);
    } catch {
      // Language switching also works when browser storage is unavailable.
    }
  });

  function updateActiveSection() {
    const sections = [...document.querySelectorAll('main > section')];
    const anchorOffset = parseFloat(getComputedStyle(sections[0]).scrollMarginTop) || 0;
    const offset = Math.max(
      document.querySelector('.site-header').getBoundingClientRect().height + 48,
      anchorOffset
    ) + 4;
    let active = sections[0];
    for (const section of sections) {
      if (section.getBoundingClientRect().top <= offset) active = section;
    }
    document.querySelectorAll('.site-nav a').forEach((anchor) => {
      if (anchor.hash === `#${active.id}`) {
        anchor.setAttribute('aria-current', 'location');
      } else {
        anchor.removeAttribute('aria-current');
      }
    });
  }

  let scrollScheduled = false;
  window.addEventListener('scroll', () => {
    if (scrollScheduled) return;
    scrollScheduled = true;
    requestAnimationFrame(() => {
      updateActiveSection();
      scrollScheduled = false;
    });
  }, { passive: true });
  window.addEventListener('resize', updateActiveSection);
  window.addEventListener('load', updateActiveSection);
})();
