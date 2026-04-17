'use client';

import { User } from '@/lib/api/auth';
import { FiMail, FiCalendar, FiTarget } from 'react-icons/fi';
import { canAccessAdminPanel } from '@/lib/utils/permissions';

interface ProfileCardProps {
  user: User;
}

export default function ProfileCard({ user }: ProfileCardProps) {
  const isAdmin = canAccessAdminPanel(user);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('vi-VN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <h2 className="text-xl font-bold text-gray-900 mb-4">Thông tin cá nhân</h2>
      
      <div className="space-y-4">
        {/* Email */}
        <div className="flex items-start space-x-3">
          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
            <FiMail className="text-blue-600" size={20} />
          </div>
          <div>
            <p className="text-sm text-gray-600">Email</p>
            <p className="text-gray-900 font-medium">{user.email}</p>
          </div>
        </div>

        {/* Join Date */}
        {user.created_at && (
          <div className="flex items-start space-x-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <FiCalendar className="text-green-600" size={20} />
            </div>
            <div>
              <p className="text-sm text-gray-600">Ngày tham gia</p>
              <p className="text-gray-900 font-medium">{formatDate(user.created_at)}</p>
            </div>
          </div>
        )}

        {/* Target Score */}
        {user.target_score && (
          <div className="flex items-start space-x-3">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <FiTarget className="text-purple-600" size={20} />
            </div>
            <div>
              <p className="text-sm text-gray-600">Điểm mục tiêu</p>
              <p className="text-gray-900 font-medium">{user.target_score} điểm</p>
            </div>
          </div>
        )}

        {/* Role Badge */}
        <div className="pt-4 border-t border-gray-200">
          <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
            isAdmin
              ? 'bg-red-100 text-red-800' 
              : 'bg-blue-100 text-blue-800'
          }`}>
            {isAdmin ? 'Quản trị viên' : 'Thành viên'}
          </span>
        </div>
      </div>
    </div>
  );
}
