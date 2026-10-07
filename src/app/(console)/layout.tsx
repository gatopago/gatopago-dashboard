import type { ReactNode } from 'react';
import { Console } from '../../components/Console';
import { settings } from '../../lib/settings';

export default function ConsoleLayout({ children }: { children: ReactNode }) {
  return <Console settings={settings}>{children}</Console>;
}
