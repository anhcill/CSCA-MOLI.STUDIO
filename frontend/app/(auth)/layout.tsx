const TURNSTILE_SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const turnstileEnabled = Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);

  return (
    <>
      {turnstileEnabled && <script async src={TURNSTILE_SCRIPT} />}
      {children}
    </>
  );
}
