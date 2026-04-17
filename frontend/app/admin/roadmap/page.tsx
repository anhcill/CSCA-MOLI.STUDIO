'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/authStore';
import { hasPermission } from '@/lib/utils/permissions';
import axios from '@/lib/utils/axios';
import { FiPlus, FiEdit2, FiTrash2, FiSave, FiX } from 'react-icons/fi';

interface Milestone {
  id: number;
  title: string;
  description: string;
  min_attempts: number;
  min_avg_score: number;
  icon: string;
  color: string;
  sort_order: number;
  is_active: boolean;
}

const EMPTY_FORM = {
  title: '',
  description: '',
  min_attempts: 0,
  min_avg_score: 0,
  icon: 'FiTarget',
  color: 'bg-indigo-500',
  sort_order: 1,
  is_active: true,
};

export default function AdminRoadmapPage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();

  const [items, setItems] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });

  useEffect(() => {
    const _token = typeof window !== 'undefined' ? sessionStorage.getItem('token') : null;
        if (!_token && (!isAuthenticated || !hasPermission(user, 'roadmap.manage'))) {
      router.push('/');
      return;
    }
    loadMilestones();
  }, [isAuthenticated, user, router]);

  const loadMilestones = async () => {
    try {
      setLoading(true);
      const res = await axios.get('/admin/roadmap/milestones', {
        params: { includeInactive: true },
      });
      setItems(res.data?.data || []);
    } catch (error: any) {
      alert(error.response?.data?.message || 'Không tải được roadmap milestones');
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setEditingId(null);
    const nextOrder = (items.length ? Math.max(...items.map((m) => m.sort_order)) : 0) + 1;
    setForm({ ...EMPTY_FORM, sort_order: nextOrder });
    setShowForm(true);
  };

  const openEdit = (item: Milestone) => {
    setEditingId(item.id);
    setForm({
      title: item.title,
      description: item.description,
      min_attempts: item.min_attempts,
      min_avg_score: Number(item.min_avg_score) || 0,
      icon: item.icon || 'FiTarget',
      color: item.color || 'bg-indigo-500',
      sort_order: item.sort_order,
      is_active: item.is_active,
    });
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
  };

  const saveMilestone = async () => {
    if (!form.title.trim() || !form.description.trim()) {
      alert('Vui lòng nhập tiêu đề và mô tả');
      return;
    }

    try {
      setSaving(true);
      if (editingId) {
        await axios.put(`/admin/roadmap/milestones/${editingId}`, form);
      } else {
        await axios.post('/admin/roadmap/milestones', form);
      }
      closeForm();
      await loadMilestones();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Lưu milestone thất bại');
    } finally {
      setSaving(false);
    }
  };

  const deleteMilestone = async (id: number, title: string) => {
    if (!confirm(`Ẩn milestone "${title}"?`)) return;

    try {
      await axios.delete(`/admin/roadmap/milestones/${id}`);
      await loadMilestones();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Ẩn milestone thất bại');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto" />
          <p className="mt-4 text-gray-600">Đang tải...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">Quản lý Lộ trình</h1>
            <p className="text-gray-600 mt-1">CRUD roadmap milestones cho trang Lộ Trình</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={openCreate}
              className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-semibold hover:shadow-lg transition-shadow flex items-center gap-2"
            >
              <FiPlus /> Thêm milestone
            </button>
            <button
              onClick={() => router.push('/admin')}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg font-semibold"
            >
              ← Quay lại
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">#</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">Tiêu đề</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">Điều kiện</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">Màu/Icon</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">Trạng thái</th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase">Hành động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {items.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm text-gray-700">{item.sort_order}</td>
                    <td className="px-6 py-4">
                      <p className="text-sm font-semibold text-gray-900">{item.title}</p>
                      <p className="text-xs text-gray-500 mt-1 line-clamp-1">{item.description}</p>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">
                      {item.min_attempts} đề • TB {Number(item.min_avg_score).toFixed(1)}+
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">
                      <span className="inline-flex items-center gap-2">
                        <span className={`px-2 py-1 text-xs rounded text-white ${item.color || 'bg-indigo-500'}`}>{item.icon || 'FiTarget'}</span>
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${item.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                        {item.is_active ? 'Active' : 'Hidden'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="inline-flex gap-2">
                        <button
                          onClick={() => openEdit(item)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                          title="Sửa"
                        >
                          <FiEdit2 />
                        </button>
                        <button
                          onClick={() => deleteMilestone(item.id, item.title)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded"
                          title="Ẩn"
                        >
                          <FiTrash2 />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">{editingId ? 'Sửa milestone' : 'Thêm milestone'}</h2>
              <button onClick={closeForm} className="text-gray-400 hover:text-gray-600"><FiX size={20} /></button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Tiêu đề</label>
                <input
                  value={form.title}
                  onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Mô tả</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  rows={3}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Min attempts</label>
                <input
                  type="number"
                  value={form.min_attempts}
                  onChange={(e) => setForm((prev) => ({ ...prev, min_attempts: Number(e.target.value) }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Min avg score</label>
                <input
                  type="number"
                  step="0.1"
                  value={form.min_avg_score}
                  onChange={(e) => setForm((prev) => ({ ...prev, min_avg_score: Number(e.target.value) }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Icon</label>
                <input
                  value={form.icon}
                  onChange={(e) => setForm((prev) => ({ ...prev, icon: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Color class</label>
                <input
                  value={form.color}
                  onChange={(e) => setForm((prev) => ({ ...prev, color: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Sort order</label>
                <input
                  type="number"
                  value={form.sort_order}
                  onChange={(e) => setForm((prev) => ({ ...prev, sort_order: Number(e.target.value) }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                />
              </div>
              <div className="flex items-end">
                <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={form.is_active}
                    onChange={(e) => setForm((prev) => ({ ...prev, is_active: e.target.checked }))}
                  />
                  Active
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button onClick={closeForm} className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700">Hủy</button>
              <button
                onClick={saveMilestone}
                disabled={saving}
                className="px-4 py-2 rounded-lg bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-60 inline-flex items-center gap-2"
              >
                <FiSave /> {saving ? 'Đang lưu...' : 'Lưu'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
