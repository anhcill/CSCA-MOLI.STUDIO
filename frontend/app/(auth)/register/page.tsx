import RegisterForm from '@/components/auth/RegisterForm';
import AuthScholarshipShell from '@/components/auth/AuthScholarshipShell';

export default function RegisterPage() {
  return (
    <AuthScholarshipShell showQuote={false} wideCard>
      <RegisterForm />
    </AuthScholarshipShell>
  );
}
