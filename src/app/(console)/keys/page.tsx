import { pageTitle } from '../../../i18n/title';
import { ApiKeys } from '../../../components/Developers';

export const generateMetadata = pageTitle('keys');

export default function Page() {
  return <ApiKeys />;
}
