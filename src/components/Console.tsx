'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { api, failureMessage } from '../lib/api';
import { shortAddress } from '../lib/format';
import { setEnglish, useEnglish } from '../lib/language';
import { currentSession, signOut, subscribeSession, type Session } from '../lib/session';
import type { ClientSettings } from '../lib/settings';
import { Brand } from './Brand';

interface ConsoleContextValue {
  settings: ClientSettings;
  session: Session;
  english: boolean;
}

const ConsoleContext = createContext<ConsoleContextValue | null>(null);

export function useConsole(): ConsoleContextValue {
  const value = useContext(ConsoleContext);
  if (!value) throw new Error('useConsole outside the console');
  return value;
}

/** Reads `path` from Flow (`/v1/…`) on mount and whenever `revision` changes. */
export function useFlow<T>(path: string, revision = 0) {
  const { settings, session, english: en } = useConsole();
  const [state, setState] = useState<{ data: T | null; error: string }>({ data: null, error: '' });
  useEffect(() => {
    const controller = new AbortController();
    api<T>(settings.apiOrigin, `/v1/${path}`, { token: session.token, signal: controller.signal })
      .then((data) => setState({ data, error: '' }))
      .catch((failure: unknown) => {
        if (!controller.signal.aborted)
          setState({ data: null, error: failureMessage(failure, en) });
      });
    return () => controller.abort();
  }, [settings, session, en, path, revision]);
  return state;
}

/** A change through Flow with the console's session. */
export function useFlowAction() {
  const { settings, session } = useConsole();
  return <T,>(path: string, init: { method?: string; body?: unknown } = {}) =>
    api<T>(settings.apiOrigin, `/v1/${path}`, { ...init, token: session.token });
}

const SECTIONS: [path: string, es: string, en: string][] = [
  ['/', 'Resumen', 'Overview'],
  ['/payments', 'Cobros', 'Payments'],
  ['/keys', 'Claves API', 'API keys'],
  ['/webhooks', 'Webhooks', 'Webhooks'],
  ['/events', 'Eventos', 'Events'],
];

/**
 * The signed-in console: its sections beside the content on wide screens, above it on phones.
 * Without a session it goes to sign-in, and comes back to the same page afterwards.
 */
export function Console({ settings, children }: { settings: ClientSettings; children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const en = useEnglish();
  const session = useSyncExternalStore(subscribeSession, currentSession, () => undefined);
  useEffect(() => {
    if (session === null)
      router.replace(pathname === '/' ? '/login' : `/login?next=${encodeURIComponent(pathname)}`);
  }, [session, router, pathname]);

  if (!session)
    return (
      <div className="grid min-h-dvh place-items-center" aria-busy="true">
        <Brand />
      </div>
    );
  const section = (path: string) =>
    path === '/' ? pathname === '/' : pathname === path || pathname.startsWith(`${path}/`);
  const links = SECTIONS.map(([path, es, english]) => (
    <Link
      key={path}
      href={path}
      aria-current={section(path) ? 'page' : undefined}
      className="nav-link"
    >
      {en ? english : es}
    </Link>
  ));
  const account = (
    <div className="flex flex-col gap-1 text-[13px]">
      <span className="text-text-faint">{en ? 'Payments arrive at' : 'Los cobros llegan a'}</span>
      <a
        href={settings.webOrigin}
        target="_blank"
        rel="noopener noreferrer"
        className="font-mono text-text underline decoration-border underline-offset-2"
      >
        {shortAddress(session.address)}
      </a>
      <div className="mt-3 flex items-center gap-1">
        <button
          type="button"
          className="btn-text -ml-3 text-[13px]"
          onClick={() => setEnglish(!en)}
        >
          {en ? 'Español' : 'English'}
        </button>
        <button type="button" className="btn-text text-[13px]" onClick={signOut}>
          {en ? 'Sign out' : 'Cerrar sesión'}
        </button>
      </div>
    </div>
  );
  return (
    <ConsoleContext value={{ settings, session, english: en }}>
      <div className="mx-auto flex min-h-dvh max-w-[1200px] flex-col md:flex-row">
        <aside className="hidden w-60 shrink-0 flex-col gap-8 border-r border-border px-5 py-7 md:flex">
          <Link href="/" aria-label="GatoPago Negocios">
            <Brand />
          </Link>
          <nav aria-label={en ? 'Sections' : 'Secciones'} className="flex flex-col gap-1.5">
            {links}
          </nav>
          <div className="mt-auto">{account}</div>
        </aside>
        {/* On phones every section stays in sight: they wrap instead of scrolling sideways. */}
        <header className="border-b border-border md:hidden">
          <div className="px-4 pt-4 pb-3">
            <Link href="/" aria-label="GatoPago Negocios">
              <Brand />
            </Link>
          </div>
          <nav
            aria-label={en ? 'Sections' : 'Secciones'}
            className="flex flex-wrap gap-2 px-4 pb-3"
          >
            {links}
          </nav>
        </header>
        <main key={pathname} className="min-w-0 flex-1 animate-fade-in px-4 py-6 md:px-10 md:py-9">
          {children}
          <div className="mt-12 border-t border-border pt-5 md:hidden">{account}</div>
        </main>
      </div>
    </ConsoleContext>
  );
}
