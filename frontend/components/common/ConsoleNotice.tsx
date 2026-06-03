'use client';

import { useEffect } from 'react';

declare global {
  interface Window {
    __molyConsoleNoticePrinted?: boolean;
  }
}

const MOLY_CONSOLE_BANNER = String.raw`
 __  __  ___  _     __   __
|  \/  |/ _ \| |    \ \ / /
| |\/| | | | | |     \ V /
| |  | | |_| | |___   | |
|_|  |_|\___/|_____|  |_|

MOLY.STUDIO
`;

const CONSOLE_WARNING = [
  'CẢNH BÁO BẢO MẬT',
  'Console này chỉ dành cho lập trình viên MOLY.STUDIO.',
  'Cấm hành vi gian lận, can thiệp request, sửa điểm, lấy đáp án, bypass gói hoặc khai thác hệ thống.',
  'Mọi hành vi bất thường có thể bị ghi nhận và khóa tài khoản.',
].join('\n');

export default function ConsoleNotice() {
  useEffect(() => {
    if (window.__molyConsoleNoticePrinted) return;
    window.__molyConsoleNoticePrinted = true;

    if (process.env.NODE_ENV === 'production') {
      console.clear();
    }

    console.log(
      `%c${MOLY_CONSOLE_BANNER}`,
      'color:#2563eb;font-weight:700;font-family:monospace;line-height:1.2;',
    );
    console.warn(
      `%c${CONSOLE_WARNING}`,
      'color:#dc2626;font-weight:700;font-family:monospace;line-height:1.5;',
    );
  }, []);

  return null;
}
