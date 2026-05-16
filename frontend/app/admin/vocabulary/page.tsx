'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/authStore';
import { hasPermission } from '@/lib/utils/permissions';
import axios from '@/lib/utils/axios';
import { FiPlus, FiTrash2, FiEdit2, FiSearch, FiX, FiCheck, FiUpload, FiChevronLeft } from 'react-icons/fi';
import { FaCrown } from 'react-icons/fa';
import Link from 'next/link';
import VocabularyReviewStats from '@/components/admin/vocabulary/VocabularyReviewStats';

interface VocabItem {
  id: number;
  word_cn: string;
  pinyin: string;
  word_vn: string;
  word_en: string;
  subject: string;
  topic: string;
  example_cn: string;
  example_vn: string;
  is_active: boolean;
  is_premium?: boolean;
  vip_tier?: string;
}

const SUBJECTS = [
  { value: 'toan', label: '📐 Toán' },
  { value: 'vat-ly', label: '⚡ Vật Lý' },
  { value: 'hoa-hoc', label: '🧪 Hóa Học' },
  { value: 'tieng-trung-xh', label: '📖 Tiếng Trung XH' },
  { value: 'tieng-trung-tn', label: '🔬 Tiếng Trung TN' },
];

const VIP_TIERS = [
  { value: 'basic', label: 'Miễn phí', color: 'gray' },
  { value: 'vip', label: 'VIP', color: 'blue' },
  { value: 'premium', label: 'Pre', color: 'amber' },
];

const EMPTY_FORM = {
  word_cn: '', pinyin: '', word_vn: '', word_en: '',
  subject: 'tieng-trung-tn', topic: '', example_cn: '', example_vn: '',
  is_premium: false, vip_tier: 'basic',
};

export default function AdminVocabularyPage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();

  const [items, setItems] = useState<VocabItem[]>([]);
  const [topics, setTopics] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Filters
  const [filterSubject, setFilterSubject] = useState('');
  const [filterTopic, setFilterTopic] = useState('');
  const [filterVip, setFilterVip] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const LIMIT = 30;

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({ ...EMPTY_FORM });

  // Bulk import
  const [showBulk, setShowBulk] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [bulkSubject, setBulkSubject] = useState('tieng-trung-tn');
  const [bulkTopic, setBulkTopic] = useState('');
  const [bulkVipTier, setBulkVipTier] = useState('basic');

  useEffect(() => {
    const _token = typeof window !== 'undefined' ? sessionStorage.getItem('token') : null;
    if (!_token) {
      router.push('/');
      return;
    }
    if (isAuthenticated && !hasPermission(user, 'content.manage')) {
      router.push('/admin');
      return;
    }
    loadData();
  }, [isAuthenticated, user]);

  useEffect(() => {
    setOffset(0);
    loadData();
  }, [filterSubject, filterTopic, searchQuery, filterVip]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const params: any = { limit: LIMIT, offset };
      if (filterSubject) params.subject = filterSubject;
      if (filterTopic) params.topic = filterTopic;
      if (searchQuery) params.search = searchQuery;
      if (filterVip === 'vip') params.is_premium = 'true';
      if (filterVip === 'premium') params.vip_tier = 'premium';
      if (filterVip === 'free') params.is_premium = 'false';

      const [vocabRes, topicsRes] = await Promise.all([
        axios.get('/vocabulary', { params }),
        axios.get('/vocabulary/topics', { params: filterSubject ? { subject: filterSubject } : {} }),
      ]);

      setItems(vocabRes.data.data || []);
      setTotal(vocabRes.data.pagination?.total || 0);
      const uniqueTopics = Array.from(new Set((topicsRes.data.data || []).map((t: any) => t.topic))) as string[];
      setTopics(uniqueTopics);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [filterSubject, filterTopic, searchQuery, filterVip, offset]);

  useEffect(() => {
    if (isAuthenticated && hasPermission(user, 'content.manage')) loadData();
  }, [offset]);

  const openAdd = () => {
    setEditingId(null);
    setFormData({ ...EMPTY_FORM });
    setShowModal(true);
  };

  const openEdit = (item: VocabItem) => {
    setEditingId(item.id);
    setFormData({
      word_cn: item.word_cn, pinyin: item.pinyin,
      word_vn: item.word_vn, word_en: item.word_en || '',
      subject: item.subject, topic: item.topic,
      example_cn: item.example_cn || '', example_vn: item.example_vn || '',
      is_premium: item.is_premium || false,
      vip_tier: item.vip_tier || 'basic',
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formData.word_cn || !formData.pinyin || !formData.word_vn || !formData.subject || !formData.topic) {
      alert('Vui lòng điền đầy đủ: từ Hán, pinyin, nghĩa Việt, môn, chủ đề');
      return;
    }
    try {
      setSaving(true);
      const payload = {
        word_cn: formData.word_cn,
        pinyin: formData.pinyin,
        word_vn: formData.word_vn,
        word_en: formData.word_en || null,
        subject: formData.subject,
        topic: formData.topic,
        example_cn: formData.example_cn || null,
        example_vn: formData.example_vn || null,
        is_premium: formData.is_premium,
        vip_tier: formData.vip_tier,
      };
      if (editingId) {
        await axios.put(`/vocabulary/${editingId}`, payload);
      } else {
        await axios.post('/vocabulary', payload);
      }
      setShowModal(false);
      loadData();
    } catch (e: any) {
      alert(e.response?.data?.message || 'Lỗi lưu từ vựng');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number, word: string) => {
    if (!confirm(`Xóa từ "${word}"?`)) return;
    try {
      await axios.delete(`/vocabulary/${id}`);
      loadData();
    } catch (e) {
      alert('Lỗi xóa từ vựng');
    }
  };

  const handleDeleteTopic = async () => {
    if (!filterSubject || !filterTopic) {
      alert('Vui lòng chọn cả môn và chủ đề trước khi xóa cả chủ đề');
      return;
    }

    const selectedSubject = subjectLabel(filterSubject);
    const ok = confirm(
      `Xóa toàn bộ từ vựng trong chủ đề "${filterTopic}" của môn ${selectedSubject}? Hành động này sẽ ẩn các từ khỏi người dùng.`,
    );
    if (!ok) return;

    try {
      setSaving(true);
      const res = await axios.delete('/vocabulary/topics', {
        data: { subject: filterSubject, topic: filterTopic },
      });
      alert(res.data?.message || 'Đã xóa chủ đề từ vựng');
      setOffset(0);
      setFilterTopic('');
    } catch (e: any) {
      alert(e.response?.data?.message || 'Lỗi xóa chủ đề từ vựng');
    } finally {
      setSaving(false);
    }
  };

  const handleBulkImport = async () => {
    if (!bulkTopic.trim()) { alert('Nhập tên chủ đề'); return; }
    try {
      // Parse format: từHán|pinyin|nghĩaViệt|nghĩaAnh (mỗi dòng 1 từ)
      const lines = bulkText.trim().split('\n').filter(l => l.trim());
      const words = lines.map(line => {
        const parts = line.split('|').map(s => s.trim());
        return {
          word_cn: parts[0] || '',
          pinyin: parts[1] || '',
          word_vn: parts[2] || '',
          word_en: parts[3] || '',
          subject: bulkSubject,
          topic: bulkTopic,
          is_premium: bulkVipTier !== 'basic',
          vip_tier: bulkVipTier,
        };
      }).filter(w => w.word_cn && w.pinyin && w.word_vn);

      if (words.length === 0) { alert('Không có từ hợp lệ. Format: 汉字|pīnyīn|nghĩa Việt|meaning EN'); return; }

      setSaving(true);
      await axios.post('/vocabulary/bulk', { words });
      setShowBulk(false);
      setBulkText('');
      loadData();
      alert(`Import thành công ${words.length} từ!`);
    } catch (e: any) {
      alert(e.response?.data?.message || 'Lỗi import');
    } finally {
      setSaving(false);
    }
  };

  const subjectLabel = (val: string) => SUBJECTS.find(s => s.value === val)?.label || val;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/admin" className="text-gray-500 hover:text-gray-800 transition-colors">
              <FiChevronLeft size={22} />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Quản lý từ vựng</h1>
              <p className="text-sm text-gray-500">{total} từ trong hệ thống</p>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setShowBulk(true)}
              className="flex items-center gap-2 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-800 transition-colors text-sm font-medium"
            >
              <FiUpload size={16} />
              Import hàng loạt
            </button>
            <button
              onClick={openAdd}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium"
            >
              <FiPlus size={16} />
              Thêm từ mới
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        <VocabularyReviewStats />

        {/* Filters */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6 flex flex-wrap gap-3 items-center">
          <div className="flex items-center gap-2 flex-1 min-w-[200px]">
            <FiSearch className="text-gray-400" />
            <input
              type="text"
              placeholder="Tìm từ Hán, pinyin, nghĩa..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="flex-1 outline-none text-gray-800 placeholder-gray-400 text-sm"
            />
          </div>
          <select
            value={filterSubject}
            onChange={e => { setFilterSubject(e.target.value); setFilterTopic(''); }}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 outline-none"
          >
            <option value="">Tất cả môn</option>
            {SUBJECTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <select
            value={filterTopic}
            onChange={e => setFilterTopic(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 outline-none"
            disabled={topics.length === 0}
          >
            <option value="">Tất cả chủ đề</option>
            {topics.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          {(filterSubject || filterTopic || searchQuery || filterVip) && (
            <button
              onClick={() => { setFilterSubject(''); setFilterTopic(''); setSearchQuery(''); setFilterVip(''); }}
              className="text-red-500 hover:text-red-700 text-sm flex items-center gap-1"
            >
              <FiX size={14} /> Xóa filter
            </button>
          )}
          {filterSubject && filterTopic && (
            <button
              onClick={handleDeleteTopic}
              disabled={saving}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
              title="Xóa toàn bộ từ vựng trong chủ đề đang chọn"
            >
              <FiTrash2 size={14} />
              Xóa cả chủ đề
            </button>
          )}
          <select
            value={filterVip}
            onChange={e => { setFilterVip(e.target.value); }}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 outline-none"
          >
            <option value="">Tất cả</option>
            <option value="free">Miễn phí</option>
            <option value="vip">VIP</option>
            <option value="premium">Premium</option>
          </select>
        </div>

        {/* Table */}
        {loading ? (
          <div className="text-center py-20"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-600 mx-auto"></div></div>
        ) : items.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <p className="text-lg mb-2">Chưa có từ vựng nào</p>
            <button onClick={openAdd} className="text-purple-600 hover:underline text-sm">+ Thêm từ đầu tiên</button>
          </div>
        ) : (
          <>
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 text-gray-600 font-semibold">Từ Hán</th>
                    <th className="text-left px-4 py-3 text-gray-600 font-semibold">Pinyin</th>
                    <th className="text-left px-4 py-3 text-gray-600 font-semibold">Tiếng Việt</th>
                    <th className="text-left px-4 py-3 text-gray-600 font-semibold hidden md:table-cell">Tiếng Anh</th>
                    <th className="text-left px-4 py-3 text-gray-600 font-semibold hidden lg:table-cell">Môn</th>
                    <th className="text-left px-4 py-3 text-gray-600 font-semibold hidden lg:table-cell">Chủ đề</th>
                    <th className="text-center px-4 py-3 text-gray-600 font-semibold">VIP</th>
                    <th className="text-center px-4 py-3 text-gray-600 font-semibold">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {items.map(item => (
                    <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-bold text-red-700 text-lg">{item.word_cn}</td>
                      <td className="px-4 py-3 text-blue-600 italic">{item.pinyin}</td>
                      <td className="px-4 py-3 text-gray-800">{item.word_vn}</td>
                      <td className="px-4 py-3 text-gray-500 hidden md:table-cell">{item.word_en || '-'}</td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full">
                          {subjectLabel(item.subject)}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">{item.topic}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {item.is_premium ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-gradient-to-r from-amber-100 to-orange-100 text-amber-700 rounded-lg text-xs font-bold">
                            <FaCrown size={10} />
                            {VIP_TIERS.find(t => t.value === (item.vip_tier || 'basic'))?.label || 'VIP'}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">Miễn phí</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => openEdit(item)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          >
                            <FiEdit2 size={15} />
                          </button>
                          <button
                            onClick={() => handleDelete(item.id, item.word_cn)}
                            className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <FiTrash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between mt-4 text-sm text-gray-600">
              <span>Hiển thị {offset + 1}–{Math.min(offset + LIMIT, total)} / {total} từ</span>
              <div className="flex gap-2">
                <button
                  disabled={offset === 0}
                  onClick={() => setOffset(Math.max(0, offset - LIMIT))}
                  className="px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  ← Trước
                </button>
                <button
                  disabled={offset + LIMIT >= total}
                  onClick={() => setOffset(offset + LIMIT)}
                  className="px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Sau →
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Bulk Import Modal */}
      {showBulk && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-lg p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-900">Import hàng loạt</h2>
              <button onClick={() => setShowBulk(false)} className="text-gray-400 hover:text-gray-600"><FiX size={20} /></button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Môn học</label>
                  <select value={bulkSubject} onChange={e => setBulkSubject(e.target.value)} className="w-full border rounded-lg px-3 py-2">
                    {SUBJECTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Chủ đề</label>
                  <input type="text" placeholder="VD: Bài 1" value={bulkTopic} onChange={e => setBulkTopic(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phân quyền VIP</label>
                <div className="flex gap-4">
                  {VIP_TIERS.map(tier => (
                    <label key={tier.value} className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" checked={bulkVipTier === tier.value}
                        onChange={() => setBulkVipTier(tier.value)}
                        className="accent-purple-600" />
                      <span className="text-sm font-medium">{tier.label}</span>
                    </label>
                  ))}
                </div>
              </div>
              <textarea placeholder={'Format mỗi dòng:\n汉字|pīnyīn|nghĩa Việt|meaning EN'} value={bulkText} onChange={e => setBulkText(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 h-48 font-mono text-sm" />
              <div className="flex gap-3">
                <button onClick={() => setShowBulk(false)} className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50">Hủy</button>
                <button onClick={handleBulkImport} disabled={saving}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900 disabled:opacity-50">
                  {saving ? <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" /> : <FiUpload size={16} />}
                  Import
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-lg p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-900">{editingId ? 'Sửa từ' : 'Thêm từ mới'}</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600"><FiX size={20} /></button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Từ Hán</label>
                  <input value={formData.word_cn} onChange={e => setFormData({ ...formData, word_cn: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-lg" placeholder="汉字" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Pinyin</label>
                  <input value={formData.pinyin} onChange={e => setFormData({ ...formData, pinyin: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2" placeholder="hanzi" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tiếng Việt</label>
                  <input value={formData.word_vn} onChange={e => setFormData({ ...formData, word_vn: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2" placeholder="nghĩa" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tiếng Anh</label>
                <input value={formData.word_en} onChange={e => setFormData({ ...formData, word_en: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2" placeholder="meaning" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Môn</label>
                  <select value={formData.subject} onChange={e => setFormData({ ...formData, subject: e.target.value })} className="w-full border rounded-lg px-3 py-2">
                    {SUBJECTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Chủ đề</label>
                  <input value={formData.topic} onChange={e => setFormData({ ...formData, topic: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2" placeholder="Bài 1" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ví dụ Hán</label>
                  <input value={formData.example_cn} onChange={e => setFormData({ ...formData, example_cn: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ví dụ Việt</label>
                  <input value={formData.example_vn} onChange={e => setFormData({ ...formData, example_vn: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phân quyền</label>
                <div className="flex gap-3">
                  {VIP_TIERS.map(tier => (
                    <label key={tier.value} className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" checked={formData.vip_tier === tier.value}
                        onChange={() => setFormData({ ...formData, vip_tier: tier.value, is_premium: tier.value !== 'basic' })}
                        className="accent-purple-600" />
                      <span className="text-sm font-medium">{tier.label}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowModal(false)} className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50">Hủy</button>
                <button onClick={handleSave} disabled={saving}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50">
                  {saving ? <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" /> : <FiCheck size={16} />}
                  {editingId ? 'Cập nhật' : 'Thêm'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
