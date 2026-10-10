import { pageTitle } from '../../../i18n/title';
import { Events } from '../../../components/Developers';

export const generateMetadata = pageTitle('events');

export default function Page() {
  return <Events />;
}
