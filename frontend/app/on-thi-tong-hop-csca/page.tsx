import SubjectSeoPage from '../_seo/SubjectSeoPage';
import { buildSubjectSeoMetadata } from '../_seo/subjectSeoData';

export const metadata = buildSubjectSeoMetadata('general');

export default function OnThiTongHopCscaPage() {
  return <SubjectSeoPage pageKey="general" />;
}
