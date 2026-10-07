/** Where to go after signing in: a path of this console only, never another site. */
export const safeNext = (value: string | null): string =>
  value && /^\/(?![/\\])\S*$/.test(value) && !value.startsWith('/login') ? value : '/';
