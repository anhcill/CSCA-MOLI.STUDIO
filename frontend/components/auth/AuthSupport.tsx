import { FiChevronDown, FiHelpCircle, FiMail, FiMessageCircle } from 'react-icons/fi';

const ZALO_NUMBER = '0815913408';
const ZALO_URL = `https://zalo.me/${ZALO_NUMBER}`;
const SUPPORT_EMAILS = ['ducanhle28072003@gmail.com', 'khlyp05@gmail.com'];

export default function AuthSupport() {
  return (
    <details className="group mt-5 border-t border-[#d8bfa8]/70 pt-4 text-[#44372f]">
      <summary className="flex cursor-pointer list-none items-center justify-center gap-2 text-center text-sm font-black text-[#bd111c] hover:text-[#8d0d14] [&::-webkit-details-marker]:hidden">
        <FiHelpCircle className="h-4 w-4 shrink-0" />
        <span>Không đăng nhập/đăng ký được? Cần trợ giúp</span>
        <FiChevronDown className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180" />
      </summary>

      <div className="mt-3 rounded-2xl border border-[#e6cdb7] bg-[#fffaf5]/80 p-3 text-center shadow-sm">
        <p className="text-xs font-semibold leading-relaxed text-[#5f5148]">
          Nếu bạn gặp lỗi khi đăng nhập hoặc đăng ký, hãy liên hệ bộ phận IT qua một trong các kênh sau:
        </p>

        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <a
            href={ZALO_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-[#d8bfa8] bg-white px-3 py-2 text-xs font-black text-[#2d2926] transition-colors hover:border-[#bd8f68] hover:bg-[#fff7ef]"
          >
            <FiMessageCircle className="h-4 w-4 text-[#087df1]" />
            Zalo {ZALO_NUMBER}
          </a>

          <a
            href={`mailto:${SUPPORT_EMAILS[0]}`}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-[#d8bfa8] bg-white px-3 py-2 text-xs font-black text-[#2d2926] transition-colors hover:border-[#bd8f68] hover:bg-[#fff7ef]"
          >
            <FiMail className="h-4 w-4 text-[#bd111c]" />
            Email IT
          </a>
        </div>

        <p className="mt-2 break-all text-[11px] font-semibold leading-relaxed text-[#6d5b4f]">
          {SUPPORT_EMAILS.map((email, index) => (
            <span key={email}>
              {index > 0 && ' · '}
              <a href={`mailto:${email}`} className="hover:text-[#bd111c] hover:underline">
                {email}
              </a>
            </span>
          ))}
        </p>
      </div>
    </details>
  );
}
