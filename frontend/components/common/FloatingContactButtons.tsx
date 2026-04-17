'use client';

import { type CSSProperties, type ReactNode, useState } from 'react';
import { FiFacebook, FiPhone } from 'react-icons/fi';
import { SiTiktok } from 'react-icons/si';

interface ContactItem {
  label: string;
  href: string;
  bgClass?: string;
  bgStyle?: CSSProperties;
  content: ReactNode;
}

const CONTACT_ITEMS: ContactItem[] = [
  {
    label: 'Zalo 0812352005',
    href: 'https://zalo.me/0812352005',
    bgStyle: { background: 'linear-gradient(135deg, #0068FF, #004FC4)' },
    content: (
      <svg width="20" height="20" viewBox="0 0 512 512" fill="white">
        <path d="M256 0C114.6 0 0 114.6 0 256s114.6 256 256 256 256-114.6 256-256S397.4 0 256 0zm107.5 323.5C349 341.9 305 338 256 338s-93 3.9-107.5 14.5C133.5 367.1 128 382 128 398c0 48.6 39.4 88 88 88s88-39.4 88-88c0-16-5.5-30.9-14.5-45.5zm-.1 88.8c-11.5 5.8-24.2 9.2-37.4 9.2-40.7 0-73.9-33.1-73.9-73.9s33.1-73.9 73.9-73.9c13.2 0 25.9 3.4 37.4 9.2C315.1 263.2 334 243 334 220c0-30.9-25.1-56-56-56s-56 25.1-56 56c0 23 18.9 43.2 42.6 47.3z"/>
      </svg>
    ),
  },
  {
    label: 'Messenger',
    href: 'https://www.facebook.com/share/1awx75D2rm/?mibextid=wwXIfr',
    bgClass: 'bg-gradient-to-br from-blue-500 to-indigo-600',
    content: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
        <path d="M12 0C5.37 0 0 4.66 0 10.4c0 3.7 2.08 6.93 5.3 8.87v-2.63l4.7 2.73 1.3-2.17-3.94-2.29V16c-.86.48-1.86.76-2.96.76C6.18 16.76 2 13.06 2 8.4S6.18 0 12 0zm5.35 14.4c.36 1.3.54 2.67.54 4.1 0 .53-.04 1.05-.12 1.56-.15-.02-.3-.04-.46-.04-.46 0-.91.08-1.33.22.23-.19.45-.4.65-.63-.45.03-.89.08-1.32.15.2-.16.39-.34.55-.54-.5.02-.98.11-1.44.25.15-.24.3-.48.42-.75-.51.08-1.01.18-1.49.3.31-.3.6-.62.86-.97-.3.15-.62.28-.95.38-.26-1.18.04-2.42.85-3.38.81-.96 2.02-1.38 3.22-1.19z"/>
      </svg>
    ),
  },
  {
    label: 'Facebook Fanpage',
    href: 'https://www.facebook.com/share/1awx75D2rm/?mibextid=wwXIfr',
    bgClass: 'bg-[#1877F2]',
    content: <FiFacebook size={18} color="white" />,
  },
  {
    label: 'TikTok @cloudly_studio',
    href: 'https://www.tiktok.com/@cloudly_studio?_r=1&_t=ZS-95aeonJsDzt',
    bgStyle: { background: 'linear-gradient(135deg, #25F4EE 0%, #FE2C55 50%, #000 100%)' },
    content: <SiTiktok size={18} color="white" />,
  },
  {
    label: 'Gọi 0812352005',
    href: 'tel:0812352005',
    bgClass: 'bg-gradient-to-br from-emerald-500 to-green-600',
    content: <FiPhone size={18} color="white" />,
  },
];

export default function FloatingContactButtons() {
  const [open, setOpen] = useState(false);

  return (
    <div
      className="fixed right-3 bottom-6 z-[70] flex flex-col items-end gap-2.5 sm:right-5 sm:bottom-8"
      aria-label="Liên hệ nhanh"
    >
      {open && (
        <div className="flex flex-col gap-2.5 items-end">
          {CONTACT_ITEMS.map((item) => (
            <a
              key={item.label}
              href={item.href}
              target={item.href.startsWith('tel:') ? undefined : '_blank'}
              rel={item.href.startsWith('tel:') ? undefined : 'noopener noreferrer'}
              aria-label={item.label}
              title={item.label}
              onClick={() => setOpen(false)}
              className="group flex items-center gap-3 animate-in fade-in slide-in-from-bottom-2 duration-200"
            >
              <div className="bg-white border border-gray-200 rounded-xl px-3.5 py-2 shadow-md text-sm font-medium text-gray-700 whitespace-nowrap hover:bg-gray-50 transition-colors">
                {item.label}
              </div>
              <div
                className={`w-12 h-12 rounded-full shadow-lg flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform ${item.bgClass || ''}`}
                style={item.bgStyle}
              >
                {item.content}
              </div>
            </a>
          ))}
        </div>
      )}

      <button
        onClick={() => setOpen((o) => !o)}
        className={[
          'w-14 h-14 rounded-full shadow-xl flex items-center justify-center',
          'transition-all duration-300 hover:scale-110 hover:shadow-2xl',
          'ring-4 ring-white/30',
          open
            ? 'bg-gray-800'
            : 'bg-gradient-to-br from-indigo-600 to-purple-600',
        ].join(' ')}
        style={!open ? { boxShadow: '0 8px 32px rgba(79,70,229,0.45)' } : undefined}
        aria-label={open ? 'Đóng liên hệ' : 'Mở liên hệ nhanh'}
      >
        {open ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        )}
      </button>
    </div>
  );
}
