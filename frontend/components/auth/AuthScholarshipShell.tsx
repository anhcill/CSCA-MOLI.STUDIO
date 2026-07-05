import type { ReactNode } from 'react';
import Link from 'next/link';
import { FaGraduationCap } from 'react-icons/fa';
import { FiBarChart2, FiBookOpen, FiEdit3, FiHome, FiUsers } from 'react-icons/fi';

const AUTH_BG_IMAGE = '/images/auth/csca-scholarship-bg.png';

const featureBadges = [
  { icon: FaGraduationCap, label: 'CSC' },
  { icon: FiHome, label: '985/211' },
  { icon: FiEdit3, label: 'Thi thử' },
  { icon: FiBookOpen, label: 'CSCA' },
];

const stats = [
  { icon: FiBarChart2, value: '98%', label: 'Tỷ lệ đậu CSCA', desc: 'Dựa trên dữ liệu học viên' },
  { icon: FiUsers, value: '1200+', label: 'Học viên', desc: 'Đã và đang đồng hành' },
  { icon: FaGraduationCap, value: '300+', label: 'Học bổng', desc: 'Đã đạt được' },
  { icon: FiEdit3, value: 'Thi thử', label: 'Luyện đề online', desc: 'Ôn thi thông minh' },
];

interface AuthScholarshipShellProps {
  children: ReactNode;
  showQuote?: boolean;
  wideCard?: boolean;
}

export default function AuthScholarshipShell({ children, showQuote = true, wideCard = false }: AuthScholarshipShellProps) {
  return (
    <main className="auth-login-page relative min-h-[100dvh] overflow-x-hidden overflow-y-auto bg-[#f8efe5] text-[#2f2926]">
      <style>{`
        .auth-login-form,
        .auth-login-form * {
          color-scheme: light;
        }

        .auth-login-input,
        .auth-login-input:hover,
        .auth-login-input:focus {
          background: rgba(255, 255, 255, 0.88) !important;
          color: #2d2926 !important;
          -webkit-text-fill-color: #2d2926 !important;
        }

        .auth-login-input:-webkit-autofill,
        .auth-login-input:-webkit-autofill:hover,
        .auth-login-input:-webkit-autofill:focus {
          -webkit-box-shadow: 0 0 0 1000px rgba(255, 255, 255, 0.92) inset !important;
          -webkit-text-fill-color: #2d2926 !important;
          caret-color: #bd111c;
          transition: background-color 9999s ease-out 0s;
        }

        @keyframes petalFall {
          0% { transform: translateY(-10vh) rotate(0deg) scale(1); opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 0.7; }
          100% { transform: translateY(105vh) rotate(720deg) scale(0.6); opacity: 0; }
        }

        @keyframes petalSway {
          0%, 100% { transform: translateX(0); }
          50% { transform: translateX(30px); }
        }

        .petal {
          position: absolute;
          top: -5%;
          pointer-events: none;
          z-index: 5;
        }

        .petal::before {
          content: '🌸';
          display: block;
          animation: petalSway 4s ease-in-out infinite;
        }

        .petal:nth-child(1) { left: 5%; animation: petalFall 12s linear 0s infinite; font-size: 1.1rem; }
        .petal:nth-child(2) { left: 12%; animation: petalFall 16s linear 3s infinite; font-size: 0.75rem; }
        .petal:nth-child(3) { left: 18%; animation: petalFall 14s linear 1s infinite; font-size: 0.9rem; }
        .petal:nth-child(4) { left: 25%; animation: petalFall 17s linear 4s infinite; font-size: 0.65rem; }
        .petal:nth-child(5) { left: 32%; animation: petalFall 13s linear 2s infinite; font-size: 1.2rem; }
        .petal:nth-child(6) { left: 38%; animation: petalFall 19s linear 6s infinite; font-size: 0.8rem; }
        .petal:nth-child(7) { left: 45%; animation: petalFall 15s linear 1.5s infinite; font-size: 1rem; }
        .petal:nth-child(8) { left: 52%; animation: petalFall 18s linear 5s infinite; font-size: 0.7rem; }
        .petal:nth-child(9) { left: 58%; animation: petalFall 14s linear 0.5s infinite; font-size: 1.15rem; }
        .petal:nth-child(10) { left: 65%; animation: petalFall 16s linear 3.5s infinite; font-size: 0.85rem; }
        .petal:nth-child(11) { left: 72%; animation: petalFall 20s linear 7s infinite; font-size: 0.6rem; }
        .petal:nth-child(12) { left: 78%; animation: petalFall 13s linear 2.5s infinite; font-size: 0.95rem; }
        .petal:nth-child(13) { left: 85%; animation: petalFall 17s linear 4.5s infinite; font-size: 1.05rem; }
        .petal:nth-child(14) { left: 92%; animation: petalFall 15s linear 1s infinite; font-size: 0.75rem; }
        .petal:nth-child(15) { left: 98%; animation: petalFall 18s linear 6s infinite; font-size: 0.8rem; }
        .petal:nth-child(16) { left: 15%; animation: petalFall 22s linear 8s infinite; font-size: 0.5rem; filter: blur(1px); }
        .petal:nth-child(17) { left: 28%; animation: petalFall 25s linear 10s infinite; font-size: 0.6rem; filter: blur(1px); }
        .petal:nth-child(18) { left: 42%; animation: petalFall 21s linear 5s infinite; font-size: 0.55rem; filter: blur(2px); }
        .petal:nth-child(19) { left: 55%; animation: petalFall 24s linear 12s infinite; font-size: 0.65rem; filter: blur(1px); }
        .petal:nth-child(20) { left: 68%; animation: petalFall 23s linear 9s infinite; font-size: 0.5rem; filter: blur(1px); }
        .petal:nth-child(21) { left: 82%; animation: petalFall 26s linear 14s infinite; font-size: 0.7rem; filter: blur(2px); }
        .petal:nth-child(22) { left: 95%; animation: petalFall 20s linear 4s infinite; font-size: 0.6rem; filter: blur(1px); }
        .petal:nth-child(23) { left: 35%; animation: petalFall 11s linear 2s infinite; font-size: 1.3rem; z-index: 20; }
        .petal:nth-child(24) { left: 75%; animation: petalFall 12s linear 0.5s infinite; font-size: 1.25rem; z-index: 20; }

        @media (min-width: 1024px) {
          .auth-login-page {
            min-height: 100dvh;
            overflow-x: hidden;
            overflow-y: auto;
          }

          .auth-login-shell {
            width: 133.333333% !important;
            min-height: 133.333333dvh !important;
            gap: 1.75rem !important;
            padding-top: 1.5rem !important;
            padding-bottom: 1.5rem !important;
            transform: scale(0.75) !important;
            transform-origin: top center !important;
          }

          .auth-login-hero {
            min-height: 570px !important;
          }

          .auth-login-card {
            max-width: 450px !important;
            padding: 2rem 2.25rem !important;
            border-radius: 1.75rem !important;
          }

          .auth-login-form > div:first-child {
            margin-bottom: 1.75rem !important;
          }

          .auth-login-form > div:first-child h1 {
            font-size: 2.25rem !important;
            line-height: 1.1 !important;
          }

          .auth-login-form > div:first-child p {
            margin-top: 0.75rem !important;
            font-size: 0.875rem !important;
          }

          .auth-login-form form > :not([hidden]) ~ :not([hidden]) {
            margin-top: 1rem !important;
          }

          .auth-login-input {
            padding-top: 0.875rem !important;
            padding-bottom: 0.875rem !important;
          }

          .auth-login-form button[type="submit"] {
            padding-top: 0.875rem !important;
            padding-bottom: 0.875rem !important;
          }
        }

        @media (min-width: 1024px) and (max-height: 820px) {
          .auth-login-shell {
            min-height: 100dvh !important;
            gap: 1.25rem !important;
            padding-top: 0.75rem !important;
            padding-bottom: 0.75rem !important;
          }

          .auth-login-hero {
            min-height: calc(100dvh - 1.5rem) !important;
          }

          .auth-login-card {
            max-width: 26rem !important;
            padding: 1.4rem 1.9rem !important;
            border-radius: 1.55rem !important;
          }

          .auth-login-form > div:first-child {
            margin-bottom: 1rem !important;
          }

          .auth-login-form > div:first-child h1 {
            font-size: 2rem !important;
            line-height: 1.1 !important;
          }

          .auth-login-form > div:first-child p {
            margin-top: 0.55rem !important;
            font-size: 0.8rem !important;
          }

          .auth-login-form form > :not([hidden]) ~ :not([hidden]) {
            margin-top: 0.78rem !important;
          }

          .auth-login-input {
            padding-top: 0.72rem !important;
            padding-bottom: 0.72rem !important;
          }

          .auth-login-form button[type="submit"] {
            padding-top: 0.82rem !important;
            padding-bottom: 0.82rem !important;
          }
        }

        @media (min-width: 1024px) and (max-height: 700px) {
          .auth-login-card {
            max-width: 25rem !important;
            padding: 1.1rem 1.6rem !important;
          }

          .auth-login-form > div:first-child h1 {
            font-size: 1.65rem !important;
          }

          .auth-login-form form > :not([hidden]) ~ :not([hidden]) {
            margin-top: 0.6rem !important;
          }

          .auth-login-input {
            padding-top: 0.58rem !important;
            padding-bottom: 0.58rem !important;
          }

          .auth-login-form button[type="submit"] {
            padding-top: 0.66rem !important;
            padding-bottom: 0.66rem !important;
          }
        }

        .auth-register-card {
          max-width: 520px !important;
        }

        .auth-register-card .auth-login-form {
          max-width: none !important;
        }
      `}</style>

      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${AUTH_BG_IMAGE})` }}
      />
      <div className="absolute inset-0 bg-gradient-to-r from-[#fff7ea]/72 via-[#fff2e5]/30 to-[#fff7ef]/55" />
      <div className="absolute inset-x-0 bottom-0 h-36 bg-gradient-to-t from-[#fff6ed]/90 to-transparent" />

      <div className="absolute right-7 top-28 hidden text-6xl font-black leading-tight text-[#b88b60]/30 [writing-mode:vertical-rl] lg:block">
        中国留学
      </div>

      {Array.from({ length: 24 }).map((_, i) => (
        <div key={i} className="petal" aria-hidden="true" />
      ))}

      <div className="auth-login-shell relative z-10 mx-auto grid min-h-[100dvh] w-full max-w-[1440px] grid-cols-1 items-center gap-7 px-5 py-6 lg:grid-cols-[1.05fr_0.95fr] lg:px-12 xl:px-16">
        <section className="auth-login-hero flex min-h-[570px] flex-col justify-center">
          <Link href="/" className="auth-login-logo mb-8 inline-flex w-fit items-center gap-4">
            <span className="auth-login-logo-mark flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#df1f24] to-[#a80f14] text-2xl font-black lowercase text-white shadow-[0_14px_30px_rgba(190,28,32,0.28)]">
              m
            </span>
            <span className="auth-login-logo-text text-3xl font-black tracking-tight">
              CSCA <span className="text-[#c1121f]">Moly</span>
            </span>
          </Link>

          <div className="max-w-3xl">
            <h1
              className="auth-login-title font-black tracking-normal text-[#2d2926]"
              style={{
                fontFamily: '"Times New Roman", Georgia, serif',
                fontSize: 'clamp(2.8rem, 4vw, 4.9rem)',
                lineHeight: 1.08,
              }}
            >
              Chinh phục
              <span className="mt-2 block text-[#bd111c]">Học bổng Trung Quốc</span>
            </h1>
            <div className="auth-login-divider my-7 flex items-center gap-5 pl-1 text-[#b88b60]">
              <span className="h-px w-20 bg-[#d7b587]" />
              <FiHome className="h-8 w-8 text-[#3f3a36]" />
              <span className="h-px w-20 bg-[#d7b587]" />
            </div>
          </div>

          <div className="auth-feature-row mt-5 flex flex-wrap gap-4">
            {featureBadges.map(({ icon: Icon, label }) => (
              <div key={label} className="auth-feature-badge flex min-h-16 min-w-32 items-center justify-center gap-3 rounded-2xl border border-[#d9bfa3]/70 bg-white/55 px-4 text-base font-bold text-[#b80f18] shadow-sm backdrop-blur-md">
                <Icon className="h-6 w-6" />
                <span>{label}</span>
              </div>
            ))}
          </div>

          <div className="auth-stat-panel mt-auto hidden max-w-4xl translate-y-3 rounded-[28px] border border-white/80 bg-white/58 p-5 shadow-[0_18px_60px_rgba(118,75,45,0.18)] backdrop-blur-xl lg:block">
            <div className="grid grid-cols-4 divide-x divide-[#d9bfa3]/60">
              {stats.map(({ icon: Icon, value, label, desc }) => (
                <div key={label} className="auth-stat-item px-6 text-center">
                  <div className="auth-stat-icon mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-[#ec5a31] to-[#bf141d] text-white shadow-lg shadow-red-900/15">
                    <Icon className="h-6 w-6" />
                  </div>
                  <p className="auth-stat-value text-3xl font-black text-[#bd111c]">{value}</p>
                  <p className="auth-stat-label mt-2 text-lg font-semibold text-[#2e2925]">{label}</p>
                  <p className="auth-stat-desc mt-1 text-sm text-[#5f534b]">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="relative z-20 flex items-center justify-center lg:justify-end">
          <div className={`auth-login-card ${wideCard ? 'auth-register-card' : ''} w-full max-w-[450px] rounded-[28px] border border-white/[0.85] bg-white/[0.82] px-7 py-8 text-[#2f2926] shadow-[0_28px_90px_rgba(88,58,34,0.22)] backdrop-blur-xl sm:px-9`}>
            {children}
          </div>
        </section>

        {showQuote && <div className="auth-login-quote pointer-events-none hidden lg:absolute lg:bottom-10 lg:right-40 lg:z-0 lg:block lg:text-right">
          <p className="font-serif text-xl font-black leading-relaxed text-[#c21a22]" style={{ fontFamily: '"KaiTi", "STKaiti", "SimSun", serif' }}>
            每一次努力，都是通往梦想的一步。
          </p>
          <p className="mt-2 text-sm text-[#4d433d]">Every effort brings you one step closer to your dream.</p>
          <div className="mt-3 inline-flex h-10 w-10 rotate-6 items-center justify-center rounded-sm border-2 border-[#c21a22] text-sm font-black text-[#c21a22]" style={{ fontFamily: '"KaiTi", "STKaiti", "SimSun", serif' }}>
            志
          </div>
        </div>}
      </div>
    </main>
  );
}
