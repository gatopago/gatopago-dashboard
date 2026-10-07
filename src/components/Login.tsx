'use client';

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';
import { failureMessage } from '../lib/api';
import { setEnglish, useEnglish } from '../lib/language';
import { safeNext } from '../lib/next';
import { currentSession, subscribeSession } from '../lib/session';
import type { ClientSettings } from '../lib/settings';
import { collectLogin, requestLogin, type LoginRequest } from '../lib/signIn';
import { Brand, Meli } from './Brand';

/** A QR renews itself this many times while the page is open, then waits for a tap. */
const RENEWALS = 5;
const POLL_MS = 2000;

export function Login({ settings }: { settings: ClientSettings }) {
  const router = useRouter();
  const en = useEnglish();
  const next = safeNext(useSearchParams().get('next'));
  const session = useSyncExternalStore(subscribeSession, currentSession, () => undefined);
  const [request, setRequest] = useState<LoginRequest | null>(null);
  const [state, setState] = useState<'loading' | 'waiting' | 'expired' | 'approved'>('loading');
  const [renewals, setRenewals] = useState(0);
  const [failure, setFailure] = useState<unknown>(null);
  const error = failure ? failureMessage(failure, en) : '';
  const [passkeyBusy, setPasskeyBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (session) router.replace(next);
  }, [session, router, next]);

  // Asks Wallet Core for a new QR; callers show the loading state first.
  const renew = useCallback(() => {
    requestLogin(settings)
      .then((value) => {
        setRequest(value);
        setState('waiting');
      })
      .catch((failure: unknown) => {
        setFailure(failure);
        setState('expired');
      });
  }, [settings]);

  useEffect(renew, [renew]);

  // The signing code (passkey and Mera) loads after the QR shows: the passkey prompt still opens
  // right on the tap.
  useEffect(() => {
    void import('../lib/signInHere');
  }, []);

  // Waits for the app's approval; an expired QR renews itself a few times.
  useEffect(() => {
    if (!request || state !== 'waiting') return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const result = await collectLogin(settings, request, controller.signal);
        if (result === 'expired') {
          if (renewals < RENEWALS && document.visibilityState === 'visible') {
            setRenewals((value) => value + 1);
            setState('loading');
            renew();
          } else setState('expired');
          return;
        }
        if (result !== 'pending') {
          setState('approved');
          return;
        }
      } catch {
        if (controller.signal.aborted) return;
      }
      timer = setTimeout(() => void poll(), POLL_MS);
    };
    timer = setTimeout(() => void poll(), POLL_MS);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [request, state, settings, renewals, renew]);

  useEffect(() => {
    const clock = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(clock);
  }, []);

  const seconds = request ? Math.max(0, request.expires_at - Math.floor(now / 1000)) : 0;
  const steps = en
    ? [
        'Open GatoPago on your phone.',
        'Tap Scan and point at this code.',
        'Confirm with your fingerprint or face.',
      ]
    : [
        'Abre GatoPago en tu teléfono.',
        'Toca Escanear y apunta a este código.',
        'Confirma con tu huella o tu rostro.',
      ];

  /** Signing in on this device: a passkey account, or a Mera one (its passkey derives the key). */
  const signInHere = (method: 'signInWithPasskey' | 'signInWithMera') => {
    setPasskeyBusy(true);
    setFailure(null);
    import('../lib/signInHere')
      .then((signIn) => signIn[method](settings))
      .catch((failure: unknown) => setFailure(failure))
      .finally(() => setPasskeyBusy(false));
  };
  const passkey = (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        className="btn btn-ghost btn-block"
        disabled={passkeyBusy}
        onClick={() => signInHere('signInWithPasskey')}
      >
        {passkeyBusy
          ? en
            ? 'Confirm on your device…'
            : 'Confirma en tu dispositivo…'
          : en
            ? 'Use my passkey on this device'
            : 'Usar mi passkey en este dispositivo'}
      </button>
      <button
        type="button"
        className="btn-text text-[13px]"
        disabled={passkeyBusy}
        onClick={() => signInHere('signInWithMera')}
      >
        {en ? 'Is your account Mera? Sign in with Mera' : '¿Tu cuenta es Mera? Entrar con Mera'}
      </button>
    </div>
  );

  return (
    <main className="mx-auto flex min-h-dvh max-w-[980px] flex-col px-5 py-6 md:px-10">
      <header className="flex items-center justify-between">
        <Brand />
        <button type="button" className="btn-text text-[13px]" onClick={() => setEnglish(!en)}>
          {en ? 'Español' : 'English'}
        </button>
      </header>
      <div className="grid flex-1 items-center gap-10 py-10 md:grid-cols-[1fr_360px] md:gap-16">
        <section className="animate-fade-up">
          <p className="kicker mb-4">{en ? 'Merchant console' : 'Consola para comercios'}</p>
          <h1 className="text-[34px] md:text-[44px]">
            {en ? 'Sign in to GatoPago Business' : 'Entra a GatoPago Negocios'}
          </h1>
          <p className="mt-3 max-w-[46ch] text-[15px] leading-relaxed text-text-muted">
            {en
              ? 'Your charges, API keys and webhooks. You sign in with the GatoPago app: no passwords.'
              : 'Tus cobros, claves API y webhooks. Entras con la app de GatoPago: sin contraseñas.'}
          </p>
          <ol className="mt-8 hidden flex-col gap-3 md:flex">
            {steps.map((step, index) => (
              <li key={step} className="flex items-center gap-3 text-[15px]">
                <span className="grid h-7 w-7 shrink-0 place-items-center border-2 border-text bg-cat-500 font-display text-[13px] text-on-cat">
                  {index + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
          <div className="mt-8 hidden max-w-[320px] md:block">{passkey}</div>
        </section>

        <section className="card-strong flex flex-col items-center p-6 text-center animate-fade-up">
          {state === 'approved' ? (
            <div role="status" className="py-10">
              <Meli variant="head-happy" className="mx-auto mb-4 w-20" />
              <p className="font-display text-[20px]">{en ? 'Approved!' : '¡Aprobado!'}</p>
              <p className="mt-1 text-[14px] text-text-muted">
                {en ? 'Signing you in…' : 'Entrando…'}
              </p>
            </div>
          ) : state === 'expired' ? (
            <div className="py-8">
              <Meli variant="head-cautious" className="mx-auto mb-4 w-20" />
              <p className="font-display text-[18px]">
                {error || (en ? 'This code expired' : 'Este código venció')}
              </p>
              <button
                type="button"
                className="btn btn-primary mt-5"
                onClick={() => {
                  setRenewals(0);
                  setFailure(null);
                  setState('loading');
                  renew();
                }}
              >
                {en ? 'Show a new code' : 'Mostrar un código nuevo'}
              </button>
            </div>
          ) : (
            <>
              <p className="mb-4 text-[14px] text-text-muted md:hidden">
                {en ? 'Scan it with the GatoPago app' : 'Escanéalo con la app de GatoPago'}
              </p>
              <div className="border-2 border-text bg-white p-3 shadow-[6px_6px_0_var(--color-cat-700)]">
                {request && state === 'waiting' ? (
                  <QRCodeSVG
                    value={request.approve_url}
                    size={232}
                    bgColor="#ffffff"
                    fgColor="#0A0A0B"
                    level="M"
                    aria-label={en ? 'Sign-in code' : 'Código para entrar'}
                  />
                ) : (
                  <div className="skeleton h-[232px] w-[232px]" aria-busy="true" />
                )}
              </div>
              <p className="mt-5 text-[13px] text-text-faint" aria-live="off">
                {state === 'waiting'
                  ? en
                    ? `Waiting for your phone · renews in ${seconds} s`
                    : `Esperando tu teléfono · se renueva en ${seconds} s`
                  : en
                    ? 'Preparing the code…'
                    : 'Preparando el código…'}
              </p>
            </>
          )}
        </section>
      </div>
      <div className="flex flex-col gap-3 md:hidden">
        {error && state !== 'expired' ? (
          <p role="alert" className="text-center text-[13px] text-danger">
            {error}
          </p>
        ) : null}
        {passkey}
      </div>
      {error && state !== 'expired' ? (
        <p role="alert" className="hidden text-[13px] text-danger md:block">
          {error}
        </p>
      ) : null}
      <footer className="mt-8 text-center text-[13px] text-text-muted">
        {en ? 'No GatoPago account? ' : '¿No tienes cuenta de GatoPago? '}
        <a href={`${settings.webOrigin}/login`} className="font-semibold text-text underline">
          {en ? 'Create it in the app' : 'Créala en la app'}
        </a>
      </footer>
    </main>
  );
}
