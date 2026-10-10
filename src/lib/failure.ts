'use client';

import { useTranslations, type Messages } from 'next-intl';
import { useCallback } from 'react';
import { ApiError } from './api';

type ErrorCode = keyof Messages['Errors'];

/**
 * The person's message for any failure (API codes and passkey prompts), from the `Errors` texts of
 * the language in use; a code without its own text says `UNKNOWN`'s.
 */
export function useFailureMessage() {
  const t = useTranslations('Errors');
  return useCallback(
    (error: unknown) => {
      const code = failureCode(error) as ErrorCode;
      return t.has(code) ? t(code) : t('UNKNOWN');
    },
    [t],
  );
}

function failureCode(error: unknown): string {
  for (let cause = error; cause instanceof Error; cause = cause.cause) {
    if (cause instanceof ApiError) return cause.code;
    if (cause.name === 'NotAllowedError' || cause.name === 'AbortError') return 'CANCELLED';
  }
  return 'UNKNOWN';
}
