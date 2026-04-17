'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/authStore';
import { hasPermission } from '@/lib/utils/permissions';
import axios from '@/lib/utils/axios';
import { FiPlus, FiTrash2, FiEdit2, FiUpload, FiX, FiExternalLink, FiCheck } from 'react-icons/fi';
import { FaCrown } from 'react-icons/fa';

interface Material {
  id: number;
  title: string;
  description: string;
  file_url: string;
  file_type: string;
  category: string;
  subject: string;
  is_active: boolean;
  created_at: string;
  is_premium?: boolean;
}

const CATEGORIES = [
  { value: 'ly-thuyet', label: 'Lý Thuyết' },
  { value: 'cau-truc-de', label: 'Cấu Trúc Đề' },
  { value: 'de-mo-phong', label: 'Đề Mô Phỏng' },
  { value: 'tu-vung', label: 'Từ Vựng' },
];

const SUBJECTS = [
  { value: 'toan', label: 'Toán' },
  { value: 'vat-ly', label: 'Vật Lý' },
  { value: 'hoa-hoc', label: 'Hóa Học' },
  { value: 'tieng-trung-xh', label: 'Tiếng Trung XH' },
  { value: 'tieng-trung-tn', label: 'Tiếng Trung TN' },
];

export default function AdminMaterialsPage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();
  const [mounted, setMounted] = useState(false);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  // Upload states
  const [uploading, setUploading] = useState(false);
  const [uploadedUrl, setUploadedUrl] = useState('');

  // Filter
  const [filterCategory, setFilterCategory] = useState('');

  // Form states
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    file_url: '',
    category: 'ly-thuyet',
    subject: 'toan',
    topic: '',
    is_premium: false,
  });

  // Wait for auth to hydrate before checking
  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!mounted) return; // wait for hydration
    const _token = typeof window !== 'undefined' ? sessionStorage.getItem('token') : null;
        if (!_token && (!isAuthenticated || !hasPermission(user, 'content.manage'))) {
      router.push('/');
      return;
    }
    loadMaterials();
  }, [mounted, isAuthenticated, user, router]);

  const loadMaterials = async () => {
    try {
      const res = await axios.get('/materials');
      setMaterials(res.data.data || []);
    } catch (error) {
      console.error('Load materials error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 20 * 1024 * 1024) {
      alert('File không được lớn hơn 20MB');
      return;
    }

    if (file.type !== 'application/pdf') {
      alert('Chỉ chấp nhận file PDF');
      return;
    }

    try {
      setUploading(true);
      const formData = new FormData();
      formData.append('file', file);

      const res = await axios.post('/materials/upload-pdf', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setUploadedUrl(res.data.data.url);
      setFormData(prev => ({ ...prev, file_url: res.data.data.url }));
      alert('Upload PDF thành công!');
    } catch (error) {
      console.error('Upload error:', error);
      alert('Lỗi khi upload PDF');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async () => {
    if (!formData.title || !formData.file_url || !formData.category) {
      alert('Vui lòng điền đầy đủ thông tin');
      return;
    }

    try {
      if (editingId) {
        await axios.put(`/materials/${editingId}`, { ...formData, is_active: true });
      } else {
        await axios.post('/materials', formData);
      }

      resetForm();
      await loadMaterials();
    } catch (error) {
      console.error('Submit error:', error);
      alert('Lỗi khi lưu tài liệu');
    }
  };

  const handleEdit = (material: Material) => {
    setEditingId(material.id);
    setFormData({
      title: material.title,
      description: material.description || '',
      file_url: material.file_url,
      category: material.category,
      subject: material.subject || 'toan',
      topic: (material as any).topic || '',
      is_premium: material.is_premium || false,
    });
    setUploadedUrl(material.file_url);
    setShowModal(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Xác nhận xóa tài liệu này?')) return;

    try {
      await axios.delete(`/materials/${id}`);
      alert('Xóa thành công!');
      loadMaterials();
    } catch (error) {
      console.error('Delete error:', error);
      alert('Lỗi khi xóa');
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      file_url: '',
      category: 'ly-thuyet',
      subject: 'toan',
      topic: '',
      is_premium: false,
    });
    setUploadedUrl('');
    setEditingId(null);
    setShowModal(false);
  };

  if (!mounted || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Đang tải...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Quản Lý Tài Liệu</h1>
            <p className="text-sm text-gray-500 mt-1">Upload và quản lý PDF tài liệu</p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            <FiPlus size={18} />
            Thêm Tài Liệu
          </button>
        </div>

        {/* Category filter */}
        <div className="flex gap-2 mb-4 flex-wrap">
          {[{ value: '', label: 'Tất cả' }, ...CATEGORIES].map(c => (
            <button key={c.value} onClick={() => setFilterCategory(c.value)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${filterCategory === c.value ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-gray-600 border-gray-200 hover:border-purple-300'
                }`}>
              {c.label}
            </button>
          ))}
        </div>

        {/* Materials List */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Tên Tài Liệu</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Danh Mục</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Môn / Chủ đề</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Ngày Tạo</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">VIP</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {materials.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-gray-500 text-sm">
                      Chưa có tài liệu nào
                    </td>
                  </tr>
                ) : (
                  materials.filter(m => !filterCategory || m.category === filterCategory).map(material => (
                    <tr key={material.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-red-50 rounded flex items-center justify-center text-red-500 text-xs">
                            PDF
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">{material.title}</p>
                            {material.description && (
                              <p className="text-xs text-gray-500 line-clamp-1">{material.description}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-block px-2 py-1 bg-purple-50 text-purple-600 text-xs rounded-full">
                          {CATEGORIES.find(c => c.value === material.category)?.label || material.category}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-block px-2 py-1 bg-blue-50 text-blue-600 text-xs rounded-full">
                          {SUBJECTS.find(s => s.value === material.subject)?.label || material.subject || '—'}
                        </span>
                        {(material as any).topic && (
                          <span className="ml-1 inline-block px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
                            {(material as any).topic}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {new Date(material.created_at).toLocaleDateString('vi-VN')}
                      </td>
                      <td className="px-4 py-3">
                        {material.is_premium ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-gradient-to-r from-amber-200 to-orange-400 text-orange-900 text-xs font-bold rounded-md shadow-sm">
                            <FaCrown /> PRO
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">Miễn phí</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-2">
                          <a
                            href={material.file_url}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1.5 text-gray-500 hover:text-blue-600 transition-colors"
                            title="Xem PDF"
                          >
                            <FiExternalLink size={16} />
                          </a>
                          <button
                            onClick={() => handleEdit(material)}
                            className="p-1.5 text-gray-500 hover:text-green-600 transition-colors"
                            title="Sửa"
                          >
                            <FiEdit2 size={16} />
                          </button>
                          <button
                            onClick={() => handleDelete(material.id)}
                            className="p-1.5 text-gray-500 hover:text-red-600 transition-colors"
                            title="Xóa"
                          >
                            <FiTrash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">
                {editingId ? 'Chỉnh Sửa Tài Liệu' : 'Thêm Tài Liệu Mới'}
              </h2>
              <button onClick={resetForm} className="text-gray-400 hover:text-gray-600">
                <FiX size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Upload PDF */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Upload PDF <span className="text-red-500">*</span>
                </label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                  {uploadedUrl ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-center gap-2 text-green-600">
                        <FiCheck size={20} />
                        <span className="text-sm font-medium">PDF đã upload thành công!</span>
                      </div>
                      <a
                        href={uploadedUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-blue-600 hover:underline block truncate"
                      >
                        {uploadedUrl}
                      </a>
                      <button
                        onClick={() => {
                          setUploadedUrl('');
                          setFormData(prev => ({ ...prev, file_url: '' }));
                        }}
                        className="text-xs text-red-600 hover:underline"
                      >
                        Xóa và upload lại
                      </button>
                    </div>
                  ) : (
                    <>
                      <FiUpload className="mx-auto text-gray-400 mb-2" size={32} />
                      <p className="text-sm text-gray-600 mb-2">Click để chọn file PDF (tối đa 20MB)</p>
                      <input
                        type="file"
                        accept="application/pdf"
                        onChange={handleFileUpload}
                        disabled={uploading}
                        className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100 cursor-pointer"
                      />
                      {uploading && <p className="text-xs text-purple-600 mt-2">Đang upload...</p>}
                    </>
                  )}
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tên Tài Liệu <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={e => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="VD: Lý thuyết Toán - Phương trình bậc 2"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Mô Tả</label>
                <textarea
                  value={formData.description}
                  onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Mô tả ngắn về tài liệu..."
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              {/* Category & Subject */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Danh Mục <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.category}
                    onChange={e => setFormData(prev => ({ ...prev, category: e.target.value }))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    {CATEGORIES.map(c => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Môn Học</label>
                  <select
                    value={formData.subject}
                    onChange={e => setFormData(prev => ({ ...prev, subject: e.target.value }))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    {SUBJECTS.map(s => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Topic */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Chủ Đề <span className="text-gray-400 font-normal text-xs">(dùng để nhóm tài liệu, VD: "Hàm số", "Dao động điều hòa")</span>
                </label>
                <input
                  type="text"
                  value={formData.topic}
                  onChange={e => setFormData(prev => ({ ...prev, topic: e.target.value }))}
                  placeholder="VD: Hàm số, Đại số, Quang học..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              {/* VIP Toggle */}
              <div className="border-t pt-4">
                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={formData.is_premium}
                      onChange={(e) => setFormData(prev => ({ ...prev, is_premium: e.target.checked }))}
                      className="sr-only"
                    />
                    <div className={`w-11 h-6 rounded-full transition-colors ${formData.is_premium ? 'bg-gradient-to-r from-amber-400 to-orange-500' : 'bg-gray-300'}`} />
                    <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${formData.is_premium ? 'translate-x-5' : 'translate-x-0'}`} />
                  </div>
                  <div className="flex items-center gap-2">
                    <FaCrown className="text-amber-500" />
                    <span className="text-sm font-semibold text-gray-700">Tài liệu VIP / PRO</span>
                  </div>
                </label>
                <p className="text-xs text-gray-400 mt-1 ml-14">Chỉ thành viên PRO mới được truy cập tài liệu này</p>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleSubmit}
                  disabled={!formData.title || !formData.file_url || uploading}
                  className="flex-1 px-4 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium"
                >
                  {editingId ? 'Cập Nhật' : 'Tạo Tài Liệu'}
                </button>
                <button
                  onClick={resetForm}
                  className="px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
                >
                  Hủy
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
