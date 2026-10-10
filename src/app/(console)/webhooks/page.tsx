import { pageTitle } from '../../../i18n/title';
import { Webhooks } from '../../../components/Developers';

export const generateMetadata = pageTitle('webhooks');

export default function Page() {
  return <Webhooks />;
}
