import SubjectSeoPage from '../_seo/SubjectSeoPage';
import { buildSubjectSeoMetadata } from '../_seo/subjectSeoData';

export const metadata = buildSubjectSeoMetadata('chinese');

export default function OnThiTiengTrungCscaPage() {
  return <SubjectSeoPage pageKey="chinese" />;
}
