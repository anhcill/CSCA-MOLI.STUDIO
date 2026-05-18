import SubjectSeoPage from '../_seo/SubjectSeoPage';
import { buildSubjectSeoMetadata } from '../_seo/subjectSeoData';

export const metadata = buildSubjectSeoMetadata('math');

export default function OnThiToanCscaPage() {
  return <SubjectSeoPage pageKey="math" />;
}
