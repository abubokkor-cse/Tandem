import { useEffect, useState } from 'react';

export type Route =
  | { name: 'home' }
  | { name: 'check' }
  | { name: 'records' }
  | { name: 'record'; id: string }
  | { name: 'about' }
  | { name: 'label' };

export function parse(hash: string): Route {
  const [, a, b] = hash.replace(/^#/, '').split('/');
  if (a === 'check') return { name: 'check' };
  if (a === 'records' && b) return { name: 'record', id: decodeURIComponent(b) };
  if (a === 'records') return { name: 'records' };
  if (a === 'about') return { name: 'about' };
  if (a === 'label') return { name: 'label' };
  return { name: 'home' };
}

export function go(path: string) {
  window.location.hash = path;
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parse(window.location.hash));
  useEffect(() => {
    const on = () => {
      setRoute(parse(window.location.hash));
      window.scrollTo({ top: 0 });
    };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}
