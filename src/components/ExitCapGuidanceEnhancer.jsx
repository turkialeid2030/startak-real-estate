import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
const { useLocale } = require('../i18n/LocaleContext.js');

function findExitCapInput(labelText) {
  const labels = Array.from(document.querySelectorAll('.rf-root label'));
  const label = labels.find((candidate) => candidate.textContent && candidate.textContent.includes(labelText));
  return label ? label.querySelector('input') : null;
}

function findMissingRequiredBanner() {
  const marker = Array.from(document.querySelectorAll('.rf-root span'))
    .find((candidate) => candidate.textContent && candidate.textContent.trim() === 'MISSING_REQUIRED');
  return marker ? marker.closest('.rounded-2xl.mb-4') : null;
}

export default function ExitCapGuidanceEnhancer() {
  const { t, locale } = useLocale();
  const exitCapLabel = useMemo(() => t('inputBuilding.exitCapRate'), [t, locale]);
  const [portalTarget, setPortalTarget] = useState(null);

  useEffect(() => {
    let frame = null;

    const refresh = () => {
      if (frame !== null) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        frame = null;
        const input = findExitCapInput(exitCapLabel);
        const banner = findMissingRequiredBanner();
        const missing = input && String(input.value || '').trim() === '';
        setPortalTarget(missing ? banner : null);
      });
    };

    const root = document.getElementById('root');
    if (!root) return undefined;

    refresh();
    const observer = new MutationObserver(refresh);
    observer.observe(root, { childList: true, subtree: true, characterData: true });
    root.addEventListener('input', refresh, true);
    root.addEventListener('change', refresh, true);
    root.addEventListener('focusout', refresh, true);

    return () => {
      if (frame !== null) cancelAnimationFrame(frame);
      observer.disconnect();
      root.removeEventListener('input', refresh, true);
      root.removeEventListener('change', refresh, true);
      root.removeEventListener('focusout', refresh, true);
    };
  }, [exitCapLabel]);

  if (!portalTarget) return null;

  const focusExitCap = () => {
    const input = findExitCapInput(exitCapLabel);
    if (!input) return;

    const accordionBody = input.closest('.rf-accordion-body');
    if (accordionBody && !accordionBody.classList.contains('open')) {
      const section = accordionBody.parentElement;
      const headerButton = section && section.firstElementChild;
      if (headerButton && headerButton.tagName === 'BUTTON') headerButton.click();
    }

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        input.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'center' });
        input.focus({ preventScroll: true });
      });
    });
  };

  return createPortal(
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={focusExitCap}
        className="px-3 py-2 rounded-lg text-xs font-semibold"
        style={{ background: '#C9A24C', color: '#0D1526' }}
      >
        {locale === 'en' ? 'Enter exit cap rate' : 'إدخال معدل رسملة الخروج'}
      </button>
      <span className="text-[10px] leading-relaxed" style={{ color: '#8C97AC' }}>
        {locale === 'en'
          ? 'Opens the valuation assumptions section and focuses the required field.'
          : 'يفتح قسم افتراضات التقييم وينقلك مباشرة إلى الحقل المطلوب.'}
      </span>
    </div>,
    portalTarget,
  );
}
