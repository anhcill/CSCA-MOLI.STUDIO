'use client';

import { ReactNode, useState } from 'react';
import { useAuthStore } from '@/lib/store/authStore';
import { isVipActive } from '@/lib/utils/permissions';
import { ProUpgradeModal } from './ProModal';

interface VipGateProps {
  children: ReactNode;
  fallback?: ReactNode;
  title?: string;
  /** If true, show modal when user is NOT VIP. If false, always render children. */
  requireVip?: boolean;
}

export function VipGate({ children, fallback, title, requireVip = true }: VipGateProps) {
  const user = useAuthStore((s) => s.user);
  const isVip = isVipActive(user);

  if (!requireVip || isVip) {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  return <VipGateModalWrapper title={title}>{children}</VipGateModalWrapper>;
}

function VipGateModalWrapper({ children, title }: { children: ReactNode; title?: string }) {
  const [showModal, setShowModal] = useState(true);

  return (
    <>
      {/* Locked content overlay */}
      <div className="relative group">
        <div className="absolute inset-0 bg-gray-100/80 backdrop-blur-[2px] z-10 flex flex-col items-center justify-center rounded-2xl">
          <div className="text-center px-6 py-8">
            <div className="bg-gradient-to-br from-amber-400 to-orange-500 w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3 shadow-lg">
              <span className="text-white text-2xl">👑</span>
            </div>
            <h4 className="font-black text-gray-800 mb-1">Nội dung dành cho VIP</h4>
            <p className="text-sm text-gray-500 mb-4">Nâng cấp PRO để truy cập</p>
            <button
              onClick={() => setShowModal(true)}
              className="bg-gradient-to-r from-amber-400 to-orange-500 text-white font-bold text-sm px-5 py-2 rounded-xl shadow-md hover:shadow-lg transition"
            >
              Nâng cấp ngay
            </button>
          </div>
        </div>

        {/* Blurred behind */}
        <div className="blur-[3px] opacity-50 pointer-events-none select-none">
          {children}
        </div>
      </div>

      <ProUpgradeModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={title || 'Tài liệu độc quyền'}
      />
    </>
  );
}

// Standalone hook for programmatic VIP checks
export function useRequireVip() {
  const user = useAuthStore((s) => s.user);
  return isVipActive(user);
}
