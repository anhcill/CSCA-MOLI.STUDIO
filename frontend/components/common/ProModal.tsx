import { Fragment } from 'react';
import { useRouter } from 'next/navigation';
import { FaCrown, FaTimes } from 'react-icons/fa';

interface ProModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
}

export function ProUpgradeModal({ isOpen, onClose, title = 'Tài liệu độc quyền' }: ProModalProps) {
  const router = useRouter();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop blur */}
      <div 
        className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      ></div>

      {/* Modal panel */}
      <div className="relative bg-white rounded-3xl shadow-2xl max-w-sm w-full mx-auto p-6 overflow-hidden animate-in fade-in zoom-in duration-200">
         {/* Decorative gradient blob */}
         <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 opacity-20 transform -skew-y-6 origin-top-left z-0"></div>

         <div className="relative z-10 flex flex-col items-center text-center mt-4">
            <div className="bg-gradient-to-br from-yellow-300 to-yellow-500 w-16 h-16 rounded-full flex items-center justify-center shadow-lg mb-4 text-white hover:scale-110 transition-transform">
               <FaCrown size={28} />
            </div>

            <h3 className="text-2xl font-black tracking-tight text-gray-900 mb-2">CSCA Pro</h3>
            <p className="text-gray-600 mb-6 font-medium">
               "{title}" là nội dung nằm trong gói Pro. Nâng cấp ngay để bứt phá điểm số của bạn!
            </p>

            <button
               onClick={() => router.push('/vip')}
               className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold py-3 px-4 rounded-xl shadow-md hover:shadow-lg hover:from-indigo-700 hover:to-purple-700 transition flex items-center justify-center gap-2"
            >
               <FaCrown className="text-yellow-400" /> Nâng cấp Pro
            </button>
            <button
               onClick={onClose}
               className="mt-4 text-gray-500 font-medium hover:text-gray-800 transition"
            >
               Để sau
            </button>
         </div>

         <button 
           onClick={onClose}
           className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 p-2"
         >
           <FaTimes />
         </button>
      </div>
    </div>
  );
}
