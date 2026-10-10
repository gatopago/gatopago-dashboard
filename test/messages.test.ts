import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createTranslator } from 'next-intl';
import { describe, expect, it } from 'vitest';
import english from '../src/messages/en.json';
import spanish from '../src/messages/es.json';

/** Every text with its full key: `Login.title`, `Events.retrying`. */
const texts = (tree: object, prefix = ''): [string, string][] =>
  Object.entries(tree).flatMap(([key, value]) =>
    typeof value === 'string' ? [[prefix + key, value]] : texts(value, `${prefix}${key}.`),
  );

/** The values a text takes (`{seconds}`) and its tags (`<code>`). */
const argumentsOf = (text: string) => [...text.matchAll(/\{(\w+)[,}]/g)].map(([, name]) => name);
const tagsOf = (text: string) => [...text.matchAll(/<(\w+)>/g)].map(([, name]) => name);

describe('texts', () => {
  it('say the same things in both languages, with the same values', () => {
    const spanishTexts = Object.fromEntries(texts(spanish));
    const englishTexts = Object.fromEntries(texts(english));
    expect(Object.keys(spanishTexts).sort()).toEqual(Object.keys(englishTexts).sort());
    for (const [key, text] of Object.entries(englishTexts)) {
      expect(new Set(argumentsOf(spanishTexts[key])), key).toEqual(new Set(argumentsOf(text)));
      expect(tagsOf(spanishTexts[key]), key).toEqual(tagsOf(text));
    }
  });

  it('are valid messages in both languages', () => {
    for (const [locale, messages] of [
      ['es', spanish],
      ['en', english],
    ] as const) {
      const errors: string[] = [];
      const t = createTranslator({
        locale,
        messages,
        onError: (error) => errors.push(error.message),
      });
      const translate = t as unknown as {
        (key: string, values: object): string;
        rich: (key: string, values: object) => unknown;
      };
      for (const [key, text] of texts(messages)) {
        const values = Object.fromEntries(argumentsOf(text).map((name) => [name, 1]));
        const tags = Object.fromEntries(
          tagsOf(text).map((tag) => [tag, (chunks: string) => chunks]),
        );
        if (tagsOf(text).length) translate.rich(key, { ...values, ...tags });
        else translate(key, values);
      }
      expect(errors, locale).toEqual([]);
    }
  });

  it('are all in the catalogs: no screen chooses a language by itself', () => {
    const files = (dir: string): string[] =>
      readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
        entry.isDirectory()
          ? files(join(dir, entry.name))
          : /\.tsx?$/.test(entry.name)
            ? [join(dir, entry.name)]
            : [],
      );
    for (const file of files('src'))
      expect(readFileSync(file, 'utf8'), file).not.toMatch(/\ben \?|english|useEnglish/);
  });
});
