import { DOCS_URL } from './brand';

export { DOCS_URL };

export function docsUrl(anchor?: string): string {
  return anchor ? `${DOCS_URL}#${anchor}` : DOCS_URL;
}
