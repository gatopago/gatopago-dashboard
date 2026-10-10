import type { Metadata } from 'next';
import type { Messages } from 'next-intl';
import { getTranslations } from 'next-intl/server';

/** A page's title in the chosen language. */
export const pageTitle =
  (key: Exclude<keyof Messages['Metadata'], 'description'>) => async (): Promise<Metadata> => ({
    title: (await getTranslations('Metadata'))(key),
  });
