// The official OneAquaHealth question wording in the app's own languages (from its i18n bundle).
// Only the official form text is translated; Tandem's own interface text stays English.
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import data from '../data/oah-i18n.json';
import { HEALTH_RATINGS, type HealthRating, type Question } from '../core/protocol';

type Locale = { name: string; pageTitles: Record<string, string | undefined>; questions: Record<string, { title?: string; text?: string; options: Record<string, string> }>; health: Record<string, unknown> };
const LOCALES = data.locales as unknown as Record<string, Locale>;
export const LANGS = Object.entries(LOCALES).map(([id, l]) => ({ id, name: l.name }));
const KEY = 'tandem.lang';

function initial(): string {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved && LOCALES[saved]) return saved;
  } catch {
    /* ignore */
  }
  const nav = (navigator.language || 'en').slice(0, 2).toLowerCase();
  return LOCALES[nav === 'nb' || nav === 'nn' ? 'no' : nav] ? (nav === 'nb' || nav === 'nn' ? 'no' : nav) : 'en';
}

const Ctx = createContext<{ lang: string; setLang: (l: string) => void }>({ lang: 'en', setLang: () => {} });

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, set] = useState(initial);
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  const setLang = (l: string) => {
    set(l);
    try {
      localStorage.setItem(KEY, l);
    } catch {
      /* ignore */
    }
  };
  return <Ctx.Provider value={{ lang, setLang }}>{children}</Ctx.Provider>;
}

export function useLang() {
  const { lang, setLang } = useContext(Ctx);
  const L = LOCALES[lang] ?? LOCALES.en;
  const q = (question: Question) => L.questions[question.id] ?? {};
  return {
    lang,
    setLang,
    isEnglish: lang === 'en',
    title: (question: Question) => q(question).title || question.title,
    text: (question: Question) => q(question).text || question.text,
    option: (question: Question, optionId: string) => q(question).options?.[optionId] || question.options.find((o) => o.id === optionId)?.label || optionId,
    pageTitle: (page: 1 | 2 | 3, fallback: string) => (page !== 2 && L.pageTitles[String(page)]) || fallback,
    health: (id: HealthRating) => {
      const h = L.health[id] as [string?, string?] | undefined;
      const en = HEALTH_RATINGS.find((r) => r.id === id)!;
      return { label: h?.[0] || en.label, description: h?.[1] || en.description };
    },
    healthQuestion: () => (L.health.question as string | undefined) || 'Provide an overall assessment of the stream ecosystem health',
  };
}

export function LangSelect() {
  const { lang, setLang } = useLang();
  return (
    <label className="lang-select" title="Language of the official OneAquaHealth questions">
      <span className="sr-only">Question language</span>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
        <circle cx="12" cy="12" r="9.5" />
        <path d="M2.5 12h19M12 2.5a14.5 14.5 0 0 1 0 19M12 2.5a14.5 14.5 0 0 0 0 19" />
      </svg>
      <select value={lang} onChange={(e) => setLang(e.target.value)}>
        {LANGS.map((l) => (
          <option key={l.id} value={l.id}>{l.name}</option>
        ))}
      </select>
    </label>
  );
}
