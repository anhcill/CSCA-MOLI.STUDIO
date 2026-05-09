import type { Metadata } from "next";

export const metadata: Metadata = {
  title: 'Hỏi Đáp Cùng Cố Vấn | CSCA MOLI.STUDIO',
};

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen" style={{ display: 'flex', flexDirection: 'column' }}>
      {children}
    </div>
  );
}
