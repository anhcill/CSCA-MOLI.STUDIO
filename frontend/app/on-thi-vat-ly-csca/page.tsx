import SubjectSeoPage from '../_seo/SubjectSeoPage';
import { buildSubjectSeoMetadata } from '../_seo/subjectSeoData';

export const metadata = buildSubjectSeoMetadata('physics');

export default function OnThiVatLyCscaPage() {
  return <SubjectSeoPage pageKey="physics" />;
}
