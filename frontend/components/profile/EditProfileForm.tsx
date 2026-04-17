'use client';

import { useState } from 'react';
import { User } from '@/lib/api/auth';
import { updateProfile, updateAvatar } from '@/lib/api/users';
import { useAuthStore } from '@/lib/store/authStore';
import { FiUpload, FiSave } from 'react-icons/fi';

interface EditProfileFormProps {
  user: User;
  onUpdate: (user: User) => void;
  onCancel: () => void;
}

export default function EditProfileForm({ user, onUpdate, onCancel }: EditProfileFormProps) {
  const { updateUser } = useAuthStore();
  const currentDisplayName = (user as any)?.display_name || '';
  const [formData, setFormData] = useState({
    full_name: user.full_name || '',
    display_name: currentDisplayName,
    bio: user.bio || '',
    target_score: user.target_score || '',
  });
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string>(user.avatar || '');
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    // Clear error when user types
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file size (max 2MB)
      if (file.size > 2 * 1024 * 1024) {
        setErrors((prev) => ({ ...prev, avatar: 'Kích thước ảnh không được vượt quá 2MB' }));
        return;
      }

      // Validate file type
      if (!file.type.startsWith('image/')) {
        setErrors((prev) => ({ ...prev, avatar: 'Vui lòng chọn file ảnh' }));
        return;
      }

      setAvatarFile(file);
      
      // Create preview only (don't save base64)
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
      
      // Clear error
      setErrors((prev) => ({ ...prev, avatar: '' }));
    }
  };

  const validateForm = () => {
    const newErrors: typeof errors = {};

    if (formData.display_name && formData.display_name.length < 2) {
      newErrors.display_name = 'Tên hiển thị phải có ít nhất 2 ký tự';
    }

    if (formData.target_score && (isNaN(Number(formData.target_score)) || Number(formData.target_score) < 0 || Number(formData.target_score) > 100)) {
      newErrors.target_score = 'Điểm mục tiêu phải từ 0 đến 100';
    }

    if (formData.bio && formData.bio.length > 500) {
      newErrors.bio = 'Giới thiệu không được vượt quá 500 ký tự';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setIsSubmitting(true);

    try {
      // Update profile info
      const updateData = {
        full_name: formData.full_name || undefined,
        display_name: formData.display_name || undefined,
        bio: formData.bio || undefined,
        target_score: formData.target_score ? Number(formData.target_score) : undefined,
      };

      const response = await updateProfile(user.id, updateData);
      let updatedUser = response.data.user;

      // Update avatar if changed (use external URL instead of base64)
      if (avatarFile) {
        // For now, use a placeholder URL or ui-avatars
        const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(
          formData.display_name || formData.full_name || user.username
        )}&size=200&background=4F46E5&color=fff`;
        
        const avatarResponse = await updateAvatar(user.id, avatarUrl);
        updatedUser = avatarResponse.data.user;
      }

      // Update auth store
      updateUser(updatedUser);
      
      // Notify parent
      onUpdate(updatedUser);
      
    } catch (error: any) {
      console.error('Update profile error:', error);
      setErrors({
        general: error.response?.data?.message || 'Cập nhật thất bại. Vui lòng thử lại.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* General Error */}
      {errors.general && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {errors.general}
        </div>
      )}

      {/* Avatar Upload */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Ảnh đại diện
        </label>
        <div className="flex items-center space-x-6">
          {/* Avatar Preview */}
          <div className="relative">
            {avatarPreview ? (
              <img
                src={avatarPreview}
                alt="Avatar preview"
                className="w-24 h-24 rounded-full object-cover border-4 border-gray-200"
              />
            ) : (
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center border-4 border-gray-200">
                <span className="text-3xl font-bold text-white">
                  {(currentDisplayName || user.username || 'U').charAt(0).toUpperCase()}
                </span>
              </div>
            )}
          </div>

          {/* Upload Button */}
          <div>
            <label className="flex items-center space-x-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg cursor-pointer transition-colors">
              <FiUpload size={18} />
              <span>Chọn ảnh</span>
              <input
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                className="hidden"
              />
            </label>
            <p className="text-xs text-gray-500 mt-2">JPG, PNG. Tối đa 2MB</p>
          </div>
        </div>
        {errors.avatar && <p className="mt-2 text-sm text-red-600">{errors.avatar}</p>}
      </div>

      {/* Full Name */}
      <div>
        <label htmlFor="full_name" className="block text-sm font-medium text-gray-700 mb-1.5">
          Họ và tên
        </label>
        <input
          type="text"
          id="full_name"
          name="full_name"
          value={formData.full_name}
          onChange={handleChange}
          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors outline-none text-gray-900"
          placeholder="Nguyễn Văn A"
        />
        {errors.full_name && <p className="mt-1.5 text-sm text-red-600">{errors.full_name}</p>}
      </div>

      {/* Display Name */}
      <div>
        <label htmlFor="display_name" className="block text-sm font-medium text-gray-700 mb-1.5">
          Tên hiển thị
        </label>
        <input
          type="text"
          id="display_name"
          name="display_name"
          value={formData.display_name}
          onChange={handleChange}
          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors outline-none text-gray-900"
          placeholder="Tên bạn muốn hiển thị"
        />
        {errors.display_name && <p className="mt-1.5 text-sm text-red-600">{errors.display_name}</p>}
      </div>

      {/* Bio */}
      <div>
        <label htmlFor="bio" className="block text-sm font-medium text-gray-700 mb-1.5">
          Giới thiệu bản thân
        </label>
        <textarea
          id="bio"
          name="bio"
          value={formData.bio}
          onChange={handleChange}
          rows={4}
          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors outline-none text-gray-900 resize-none"
          placeholder="Viết vài dòng về bản thân..."
        />
        <p className="mt-1.5 text-sm text-gray-500">
          {formData.bio.length}/500 ký tự
        </p>
        {errors.bio && <p className="mt-1.5 text-sm text-red-600">{errors.bio}</p>}
      </div>

      {/* Target Score */}
      <div>
        <label htmlFor="target_score" className="block text-sm font-medium text-gray-700 mb-1.5">
          Điểm mục tiêu
        </label>
        <input
          type="number"
          id="target_score"
          name="target_score"
          value={formData.target_score}
          onChange={handleChange}
          min="0"
          max="100"
          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors outline-none text-gray-900"
          placeholder="Ví dụ: 85"
        />
        {errors.target_score && <p className="mt-1.5 text-sm text-red-600">{errors.target_score}</p>}
      </div>

      {/* Action Buttons */}
      <div className="flex space-x-4 pt-4">
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex-1 flex items-center justify-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <FiSave size={18} />
          <span>{isSubmitting ? 'Đang lưu...' : 'Lưu thay đổi'}</span>
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
          className="px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Hủy
        </button>
      </div>
    </form>
  );
}
