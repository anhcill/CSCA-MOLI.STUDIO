import SubjectSeoPage from '../_seo/SubjectSeoPage';
import { buildSubjectSeoMetadata } from '../_seo/subjectSeoData';

export const metadata = buildSubjectSeoMetadata('chemistry');

export default function OnThiHoaCscaPage() {
  return <SubjectSeoPage pageKey="chemistry" />;
}
