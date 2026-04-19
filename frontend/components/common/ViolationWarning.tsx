'use client';

import { useEffect } from 'react';
import { FiAlertTriangle, FiShield, FiX } from 'react-icons/fi';

interface ViolationWarningProps {
  count: number;
  maxViolations: number;
  onClose: () => void;
}

export function ViolationWarning({ count, maxViolations, onClose }: ViolationWarningProps) {
  const remaining = maxViolations - count;
  const isLast = remaining <= 1;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 p-6 text-center border-2 border-red-200 animate-in zoom-in-95 duration-200">
        <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
          <FiAlertTriangle size={32} className="text-red-600" />
        </div>

        <h2 className="text-xl font-black text-gray-900 mb-2">Cảnh báo vi phạm!</h2>

        <p className="text-gray-600 mb-4">
          Bạn đã thực hiện hành động không được phép trong phòng thi.
        </p>

        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-red-700">
              <FiShield size={18} />
              <span className="font-semibold text-sm">Vi phạm lần thứ {count}</span>
            </div>
            <span className={`text-sm font-bold px-2 py-1 rounded-full ${isLast ? 'bg-red-600 text-white' : 'bg-red-100 text-red-700'}`}>
              Còn {remaining} lần cảnh báo
            </span>
          </div>
          {isLast && (
            <p className="mt-2 text-xs text-red-600 font-medium">
              Lần vi phạm tiếp theo sẽ bị đánh dấu trong bài thi và thông báo cho quản trị viên!
            </p>
          )}
        </div>

        <div className="bg-gray-50 rounded-xl p-3 mb-4 text-left text-sm text-gray-600 space-y-1">
          <p className="font-semibold text-gray-700 mb-1">Các hành vi bị nghiêm cấm:</p>
          <p>• Chuyển tab hoặc cửa sổ khác</p>
          <p>• Click chuột phải / Copy nội dung</p>
          <p>• Chụp màn hình hoặc in đề thi</p>
          <p>• Sử dụng phím tắt PrintScreen</p>
        </div>

        <button
          onClick={onClose}
          className="w-full py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition-colors"
        >
          Tôi đã hiểu, tiếp tục làm bài
        </button>
      </div>
    </div>
  );
}
