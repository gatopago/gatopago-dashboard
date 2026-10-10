import { pageTitle } from '../../../i18n/title';
import { Payments } from '../../../components/Payments';

export const generateMetadata = pageTitle('payments');

export default function Page() {
  return <Payments />;
}
