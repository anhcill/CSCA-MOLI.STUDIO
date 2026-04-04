import { redirect } from 'next/navigation';

// Redirect directly to exam list to improve performance
export default function ToanPage() {
  redirect('/toan/de-mo-phong');
}
