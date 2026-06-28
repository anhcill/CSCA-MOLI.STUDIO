'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/authStore';
import { hasPermission } from '@/lib/utils/permissions';
import axios from '@/lib/utils/axios';
import { FiPlus, FiTrash2, FiEdit2, FiUpload, FiX, FiExternalLink, FiCheck, FiBookOpen } from 'react-icons/fi';
import { FaCrown } from 'react-icons/fa';

interface Material {
  id: number;
  title: string;
  description: string;
  file_url: string;
  file_type: string;
  category: string;
  subject: string;
  topic?: string;
  is_active: boolean;
  created_at: string;
  is_premium?: boolean;
  content_text?: string;
  content_html?: string;
  content_source?: string;
  content_meta?: Record<string, any>;
}

type MaterialImageItem = {
  url: string;
  publicId?: string;
  caption?: string;
  order: number;
  width?: number | null;
  height?: number | null;
};

const CATEGORIES = [
  { value: 'ly-thuyet', label: 'Lý Thuyết' },
  { value: 'cong-thuc-on-thi', label: 'Công Thức Ôn Thi' },
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

const MAX_MATERIAL_UPLOAD_MB = 500;
const FORMULA_CATEGORY = 'cong-thuc-on-thi';
const DEFAULT_FORM_DATA = {
  title: '',
  description: '',
  file_url: '',
  category: 'ly-thuyet',
  subject: 'toan',
  topic: '',
  is_premium: false,
  content_text: '',
  content_html: '',
  content_meta: {} as Record<string, any>,
};

type MaterialImportMode = 'pdf' | 'web' | 'images';

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
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState('');
  const [uploadFileName, setUploadFileName] = useState('');

  // Filter
  const [filterCategory, setFilterCategory] = useState('');
  const [filterSubject, setFilterSubject] = useState('');

  // Form states
  const [formData, setFormData] = useState(DEFAULT_FORM_DATA);
  const [importMode, setImportMode] = useState<MaterialImportMode>('pdf');
  const materialImages = ((formData.content_meta?.images || []) as MaterialImageItem[])
    .slice()
    .sort((a, b) => (a.order || 0) - (b.order || 0));

  // Wait for auth to hydrate before checking
  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!mounted) return; // wait for hydration
    const _token = typeof window !== 'undefined' ? sessionStorage.getItem('token') : null;
    if (!_token) {
      router.push('/');
      return;
    }
    if (isAuthenticated && !hasPermission(user, 'content.manage')) {
      router.push('/admin');
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

    if (file.size > MAX_MATERIAL_UPLOAD_MB * 1024 * 1024) {
      alert(`File không được lớn hơn ${MAX_MATERIAL_UPLOAD_MB}MB`);
      return;
    }

    if (file.type !== 'application/pdf') {
      alert('Chỉ chấp nhận file PDF');
      return;
    }

    try {
      setUploading(true);
      setUploadProgress(0);
      setUploadFileName(file.name);
      setUploadStatus('Đang gửi file lên server...');
      const formData = new FormData();
      formData.append('file', file);
      formData.append('mode', importMode);

      const res = await axios.post('/materials/upload-pdf', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 900000,
        onUploadProgress: (event) => {
          const total = event.total || file.size;
          if (!total) return;
          const percent = Math.min(100, Math.round((event.loaded / total) * 100));
          setUploadProgress(percent);
          setUploadStatus(percent >= 100 ? 'Đã gửi file, đang chuyển sang kho lưu trữ...' : `Đang upload ${percent}%`);
        },
      });

      setUploadedUrl(res.data.data.url);
      setFormData(prev => ({
        ...prev,
        file_url: res.data.data.url,
        title: prev.title || (prev.category === FORMULA_CATEGORY ? file.name.replace(/\.[^.]+$/, '') : prev.title),
        topic: prev.topic || (prev.category === FORMULA_CATEGORY ? 'Công thức' : prev.topic),
        content_text: importMode === 'web' ? (res.data.data.content_text || prev.content_text) : '',
        content_html: '',
        content_meta: {
          ...(res.data.data.content_meta || {}),
          importMode,
        },
      }));
      setUploadProgress(100);
      setUploadStatus('Upload xong');
      const warnings = Array.isArray(res.data?.warnings) ? res.data.warnings.join('\n') : '';
      alert(`${res.data?.message || 'Upload PDF thành công!'}${warnings ? `\n${warnings}` : ''}`);
    } catch (error: any) {
      console.error('Upload error:', error);
      const message = error.response?.data?.message || error.message || 'Lỗi khi upload PDF';
      setUploadStatus(message);
      alert(message);
    } finally {
      setUploading(false);
    }
  };

  const handleImagesUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    if (files.some(file => !file.type.startsWith('image/'))) {
      alert('Chỉ chấp nhận file ảnh');
      return;
    }

    try {
      setUploading(true);
      setUploadProgress(0);
      setUploadFileName(`${files.length} ảnh`);
      setUploadStatus('Đang gửi ảnh lên Cloudinary...');
      const payload = new FormData();
      files.forEach(file => payload.append('files', file));

      const res = await axios.post('/materials/upload-images', payload, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 900000,
        onUploadProgress: (event) => {
          const total = event.total || files.reduce((sum, file) => sum + file.size, 0);
          if (!total) return;
          const percent = Math.min(100, Math.round((event.loaded / total) * 100));
          setUploadProgress(percent);
          setUploadStatus(percent >= 100 ? 'Đã gửi ảnh, đang lưu Cloudinary...' : `Đang upload ${percent}%`);
        },
      });

      const currentImages = materialImages;
      const nextImages = [
        ...currentImages,
        ...(res.data?.data?.images || []).map((image: MaterialImageItem, index: number) => ({
          ...image,
          order: currentImages.length + index + 1,
        })),
      ];

      setFormData(prev => ({
        ...prev,
        file_url: prev.file_url || nextImages[0]?.url || '',
        content_text: '',
        content_html: '',
        content_meta: {
          ...prev.content_meta,
          importMode: 'images',
          images: nextImages,
        },
      }));
      setUploadProgress(100);
      setUploadStatus('Upload ảnh xong');
    } catch (error: any) {
      console.error('Images upload error:', error);
      const message = error.response?.data?.message || error.message || 'Lỗi upload ảnh';
      setUploadStatus(message);
      alert(message);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const updateMaterialImage = (index: number, patch: Partial<MaterialImageItem>) => {
    const nextImages = materialImages.map((image, imageIndex) => (
      imageIndex === index ? { ...image, ...patch } : image
    ));
    setFormData(prev => ({
      ...prev,
      file_url: nextImages[0]?.url || '',
      content_meta: { ...prev.content_meta, importMode: 'images', images: nextImages },
    }));
  };

  const moveMaterialImage = (index: number, direction: -1 | 1) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= materialImages.length) return;
    const nextImages = [...materialImages];
    [nextImages[index], nextImages[nextIndex]] = [nextImages[nextIndex], nextImages[index]];
    const ordered = nextImages.map((image, imageIndex) => ({ ...image, order: imageIndex + 1 }));
    setFormData(prev => ({
      ...prev,
      file_url: ordered[0]?.url || '',
      content_meta: { ...prev.content_meta, importMode: 'images', images: ordered },
    }));
  };

  const removeMaterialImage = (index: number) => {
    const ordered = materialImages
      .filter((_, imageIndex) => imageIndex !== index)
      .map((image, imageIndex) => ({ ...image, order: imageIndex + 1 }));
    setFormData(prev => ({
      ...prev,
      file_url: ordered[0]?.url || '',
      content_meta: { ...prev.content_meta, importMode: 'images', images: ordered },
    }));
  };

  const handleSubmit = async () => {
    const hasImages = materialImages.length > 0;
    const hasBody = Boolean(formData.file_url || formData.content_text.trim() || hasImages);
    if (!formData.title || !formData.category || !hasBody) {
      alert('Vui l?ng nh?p ti?u ??, danh m?c v? upload PDF, ?nh ho?c nh?p n?i dung web');
      return;
    }

    try {
      const payload = importMode === 'pdf'
        ? { ...formData, content_text: '', content_html: '', content_meta: { ...formData.content_meta, importMode: 'pdf', images: [] } }
        : importMode === 'images'
          ? { ...formData, file_url: formData.file_url || materialImages[0]?.url || '', content_text: '', content_html: '', content_meta: { ...formData.content_meta, importMode: 'images', images: materialImages } }
          : { ...formData, content_meta: { ...formData.content_meta, importMode: 'web' } };

      if (editingId) {
        await axios.put(`/materials/${editingId}`, { ...payload, is_active: true });
      } else {
        await axios.post('/materials', payload);
      }

      resetForm();
      await loadMaterials();
    } catch (error) {
      console.error('Submit error:', error);
      alert('L?i khi l?u t?i li?u');
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
      topic: material.topic || '',
      is_premium: material.is_premium || false,
      content_text: material.content_text || '',
      content_html: material.content_html || '',
      content_meta: material.content_meta || {},
    });
    setImportMode((material.content_meta?.importMode === 'images' || Array.isArray(material.content_meta?.images)) ? 'images' : material.content_html || material.content_text ? 'web' : 'pdf');
    setUploadedUrl(material.file_url || '');
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
    setFormData(DEFAULT_FORM_DATA);
    setUploadedUrl('');
    setEditingId(null);
    setShowModal(false);
  };

  const openCreateModal = (category = 'ly-thuyet') => {
    setEditingId(null);
    setUploadedUrl('');
    setUploadProgress(0);
    setUploadStatus('');
    setUploadFileName('');
    setImportMode('pdf');
    setFormData({
      ...DEFAULT_FORM_DATA,
      category,
      topic: category === FORMULA_CATEGORY ? 'Công thức' : '',
    });
    setShowModal(true);
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

  const filteredMaterials = materials.filter(m =>
    (!filterCategory || m.category === filterCategory) &&
    (!filterSubject || m.subject === filterSubject)
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Quản Lý Tài Liệu</h1>
            <p className="text-sm text-gray-500 mt-1">Upload và quản lý PDF tài liệu</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => openCreateModal(FORMULA_CATEGORY)}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
            >
              <FiBookOpen size={18} />
              Thêm Công Thức
            </button>
            <button
              onClick={() => openCreateModal()}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              <FiPlus size={18} />
              Thêm Tài Liệu
            </button>
          </div>
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

        <div className="flex gap-2 mb-4 flex-wrap">
          {[{ value: '', label: 'Tất cả môn' }, ...SUBJECTS].map(s => (
            <button key={s.value} onClick={() => setFilterSubject(s.value)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${filterSubject === s.value ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'
                }`}>
              {s.label}
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
                {filteredMaterials.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-gray-500 text-sm">
                      Chưa có tài liệu nào
                    </td>
                  </tr>
                ) : (
                  filteredMaterials.map(material => (
                    <tr key={material.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className={`w-8 h-8 rounded flex items-center justify-center text-xs ${Array.isArray(material.content_meta?.images) && material.content_meta.images.length ? 'bg-sky-50 text-sky-600' : material.content_html ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500'}`}>
                            {Array.isArray(material.content_meta?.images) && material.content_meta.images.length ? 'IMG' : material.content_html ? 'WEB' : 'PDF'}
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
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Kiểu nhập tài liệu
                </label>
                <div className="grid grid-cols-1 gap-2 rounded-xl bg-gray-100 p-1 sm:grid-cols-3">
                  {[
                    { value: 'pdf', label: 'PDF thuần', desc: 'Chỉ lưu file PDF, không tạo nội dung web' },
                    { value: 'web', label: 'Bài web', desc: 'Trích/nạp nội dung để hiển thị trên web' },
                    { value: 'images', label: 'Ảnh theo chủ đề', desc: 'Upload nhiều ảnh cắt từ PDF' },
                  ].map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => {
                        const nextMode = option.value as MaterialImportMode;
                        if (importMode === 'images' && nextMode !== 'images') {
                          setUploadedUrl('');
                        }
                        setImportMode(option.value as MaterialImportMode);
                        if (option.value === 'pdf') {
                          setFormData(prev => ({ ...prev, file_url: importMode === 'images' ? '' : prev.file_url, content_text: '', content_html: '', content_meta: { ...prev.content_meta, images: [] } }));
                        }
                        if (option.value === 'web' && importMode === 'images') {
                          setFormData(prev => ({ ...prev, file_url: '', content_text: '', content_html: '', content_meta: { ...prev.content_meta, images: [] } }));
                        }
                        if (option.value === 'images') {
                          setFormData(prev => ({ ...prev, content_text: '', content_html: '', file_url: materialImages[0]?.url || prev.file_url }));
                        }
                      }}
                      className={`rounded-lg px-3 py-2 text-left transition-colors ${
                        importMode === option.value
                          ? 'bg-white text-purple-700 shadow-sm'
                          : 'text-gray-600 hover:bg-white/60'
                      }`}
                    >
                      <span className="block text-sm font-bold">{option.label}</span>
                      <span className="block text-xs">{option.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {importMode !== 'images' && (
              <div>
                {/* Upload PDF */}
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {formData.category === FORMULA_CATEGORY ? 'Upload PDF công thức' : 'Upload PDF'} <span className="text-gray-400 font-normal text-xs">{importMode === 'web' ? '(tự trích nội dung nếu PDF có text)' : '(PDF thuần, không tạo nội dung web)'}</span>
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
                          setUploadProgress(0);
                          setUploadStatus('');
                          setUploadFileName('');
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
                      <p className="text-sm text-gray-600 mb-2">Click để chọn file PDF (tối đa {MAX_MATERIAL_UPLOAD_MB}MB)</p>
                      <input
                        type="file"
                        accept="application/pdf"
                        onChange={handleFileUpload}
                        disabled={uploading}
                        className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100 cursor-pointer"
                      />
                      {uploading && (
                        <div className="mt-3 text-left">
                          <div className="flex items-center justify-between gap-3 text-xs text-purple-700">
                            <span className="truncate">{uploadFileName || 'Đang upload PDF...'}</span>
                            <span className="font-semibold">{uploadProgress}%</span>
                          </div>
                          <div className="mt-2 h-2 overflow-hidden rounded-full bg-purple-100">
                            <div className="h-full rounded-full bg-purple-600 transition-all" style={{ width: `${uploadProgress}%` }} />
                          </div>
                          <p className="mt-2 text-xs text-purple-600">{uploadStatus || 'Đang upload...'}</p>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>


              )}

              {importMode === 'images' && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Upload ảnh theo chủ đề <span className="text-gray-400 text-xs">(lưu Cloudinary, DB chỉ lưu URL)</span>
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleImagesUpload}
                    disabled={uploading}
                    className="block w-full text-sm text-gray-500 file:mr-4 file:rounded-lg file:border-0 file:bg-purple-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-purple-700 hover:file:bg-purple-100"
                  />
                  {uploading && (
                    <div className="mt-3 text-left">
                      <div className="flex items-center justify-between gap-3 text-xs text-purple-700">
                        <span className="truncate">{uploadFileName || 'Đang upload ảnh...'}</span>
                        <span className="font-semibold">{uploadProgress}%</span>
                      </div>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-purple-100">
                        <div className="h-full rounded-full bg-purple-600 transition-all" style={{ width: `${uploadProgress}%` }} />
                      </div>
                      <p className="mt-2 text-xs text-purple-600">{uploadStatus || 'Đang upload...'}</p>
                    </div>
                  )}
                  {materialImages.length > 0 && (
                    <div className="mt-4 space-y-3">
                      {materialImages.map((image, index) => (
                        <div key={image.publicId || image.url} className="grid gap-3 rounded-lg border border-slate-200 bg-white p-3 sm:grid-cols-[96px_1fr_auto] sm:items-center">
                          <img src={image.url} alt={image.caption || `Ảnh ${index + 1}`} className="h-24 w-24 rounded-lg border border-slate-200 object-cover" />
                          <input
                            type="text"
                            value={image.caption || ''}
                            onChange={(event) => updateMaterialImage(index, { caption: event.target.value })}
                            placeholder={`Chú thích ảnh ${index + 1} (không bắt buộc)`}
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                          />
                          <div className="flex gap-2 sm:flex-col">
                            <button type="button" onClick={() => moveMaterialImage(index, -1)} disabled={index === 0} className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600 disabled:opacity-40">Lên</button>
                            <button type="button" onClick={() => moveMaterialImage(index, 1)} disabled={index === materialImages.length - 1} className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600 disabled:opacity-40">Xuống</button>
                            <button type="button" onClick={() => removeMaterialImage(index)} className="rounded-lg bg-red-50 px-2 py-1 text-xs font-bold text-red-600">Xóa</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

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

              {importMode === 'web' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {formData.category === FORMULA_CATEGORY ? 'Nội dung công thức OCR/extract' : 'Nội dung web'} <span className="text-gray-400 font-normal text-xs">(PDF upload sẽ tự điền, có thể sửa lại)</span>
                </label>
                <textarea
                  value={formData.content_text}
                  onChange={e => setFormData(prev => ({ ...prev, content_text: e.target.value, content_html: '' }))}
                  placeholder={formData.category === FORMULA_CATEGORY ? 'Nội dung công thức sau khi trích từ PDF...' : 'Nhập hoặc chỉnh nội dung lý thuyết hiển thị trên web...'}
                  rows={8}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono text-sm"
                />
                {formData.content_text && (
                  <p className="mt-1 text-xs text-green-600">
                    Nội dung này sẽ được chuyển thành bài học web khi lưu.
                  </p>
                )}
              </div>

              )}

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
                  disabled={!formData.title || (!formData.file_url && !formData.content_text.trim() && materialImages.length === 0) || uploading}
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
