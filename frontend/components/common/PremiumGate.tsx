'use client';

import { ReactNode, useState } from 'react';
import { useAuthStore } from '@/lib/store/authStore';
import { isVipActive, isPremiumActive, canUseAI, canWatchVideo, canChatInstructor } from '@/lib/utils/permissions';
import { ProUpgradeModal } from './ProModal';

type GateType = 'vip' | 'premium' | 'ai' | 'video' | 'chat';

interface GateConfig {
  icon: string;
  title: string;
  description: string;
  upgradeText: string;
  color: string;
  bgColor: string;
}

const GATE_CONFIGS: Record<GateType, GateConfig> = {
  vip: {
    icon: '👑',
    title: 'Nội dung dành cho VIP',
    description: 'Nâng cấp VIP để truy cập nội dung này',
    upgradeText: 'Nâng cấp VIP',
    color: 'text-indigo-700',
    bgColor: 'bg-indigo-50',
  },
  premium: {
    icon: '✨',
    title: 'Nội dung dành cho Premium',
    description: 'Nâng cấp Premium để truy cập',
    upgradeText: 'Nâng cấp Premium',
    color: 'text-amber-700',
    bgColor: 'bg-amber-50',
  },
  ai: {
    icon: '🤖',
    title: 'Phân tích AI chỉ dành cho Premium/VIP',
    description: 'Nâng cấp gói Premium hoặc VIP để sử dụng AI phân tích',
    upgradeText: 'Nâng cấp Premium/VIP',
    color: 'text-purple-700',
    bgColor: 'bg-purple-50',
  },
  video: {
    icon: '🎬',
    title: 'Video giải đề chỉ dành cho Premium',
    description: 'Nâng cấp gói Premium để xem video giải đề chi tiết',
    upgradeText: 'Nâng cấp Premium',
    color: 'text-red-700',
    bgColor: 'bg-red-50',
  },
  chat: {
    icon: '💬',
    title: 'Chat với giảng viên chỉ dành cho Premium',
    description: 'Nâng cấp gói Premium để trò chuyện với giảng viên hỗ trợ',
    upgradeText: 'Nâng cấp Premium',
    color: 'text-blue-700',
    bgColor: 'bg-blue-50',
  },
};

/**
 * Check gate access based on type
 */
function checkGateAccess(user: any, type: GateType): boolean {
  switch (type) {
    case 'vip':
      return isVipActive(user);
    case 'premium':
      return isPremiumActive(user);
    case 'ai':
      return canUseAI(user);
    case 'video':
      return canWatchVideo(user);
    case 'chat':
      return canChatInstructor(user);
    default:
      return false;
  }
}

interface PremiumGateProps {
  children: ReactNode;
  type: GateType;
  fallback?: ReactNode;
  showOverlay?: boolean;
}

export function PremiumGate({ children, type, fallback, showOverlay = true }: PremiumGateProps) {
  const user = useAuthStore((s) => s.user);
  const hasAccess = checkGateAccess(user, type);
  const config = GATE_CONFIGS[type];

  if (hasAccess) {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  if (!showOverlay) {
    return null;
  }

  return <GateOverlay type={type} config={config} />;
}

function GateOverlay({ type, config }: { type: GateType; config: GateConfig }) {
  const [showModal, setShowModal] = useState(true);

  return (
    <>
      <div className={`relative group rounded-2xl overflow-hidden border-2 border-dashed ${config.color.replace('text-', 'border-')}`}>
        {/* Blurred behind */}
        <div className="blur-[4px] opacity-40 pointer-events-none select-none">
          <div className="min-h-[200px] flex items-center justify-center">
            <div className="text-center text-gray-400">
              <p>Locked Content</p>
            </div>
          </div>
        </div>

        {/* Overlay */}
        <div className={`absolute inset-0 ${config.bgColor}/90 backdrop-blur-[2px] z-10 flex flex-col items-center justify-center p-6 rounded-2xl`}>
          <div className="text-center">
            <div className={`w-16 h-16 ${config.bgColor} rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg`}>
              <span className="text-3xl">{config.icon}</span>
            </div>
            <h4 className={`font-bold text-lg ${config.color} mb-2`}>{config.title}</h4>
            <p className="text-sm text-gray-600 mb-4 max-w-xs mx-auto">{config.description}</p>
            <button
              onClick={() => setShowModal(true)}
              className={`bg-gradient-to-r from-amber-400 to-orange-500 text-white font-bold text-sm px-6 py-2.5 rounded-xl shadow-md hover:shadow-lg transition-all hover:scale-105`}
            >
              {config.upgradeText}
            </button>
          </div>
        </div>
      </div>

      <ProUpgradeModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={config.title}
      />
    </>
  );
}

// Hook for programmatic checks
export function useGateAccess(type: GateType) {
  const user = useAuthStore((s) => s.user);
  return checkGateAccess(user, type);
}
