'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/authStore';
import { hasPermission } from '@/lib/utils/permissions';
import axios from '@/lib/utils/axios';
import { FiDollarSign, FiUsers, FiActivity, FiSearch, FiCheckCircle, FiXCircle, FiMoreVertical, FiClock } from 'react-icons/fi';
import { FaCrown } from 'react-icons/fa';

export default function AdminVipPage() {
    const router = useRouter();
    const { user, isAuthenticated } = useAuthStore();
    
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState<any>({});
    const [users, setUsers] = useState<any[]>([]);
    const [transactions, setTransactions] = useState<any[]>([]);
    
    // Tabs: 'users' | 'transactions'
    const [activeTab, setActiveTab] = useState('users');
    
    // Grant Modal
    const [showGrantModal, setShowGrantModal] = useState(false);
    const [grantUserId, setGrantUserId] = useState('');
    const [grantDuration, setGrantDuration] = useState('30');
    const [grantReason, setGrantReason] = useState('');

    useEffect(() => {
        const _token = typeof window !== 'undefined' ? sessionStorage.getItem('token') : null;
        if (!_token && (!isAuthenticated || !hasPermission(user, 'users.manage'))) {
            router.push('/');
            return;
        }
        fetchData();
    }, [isAuthenticated, user, activeTab]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const statsRes = await axios.get('/admin/vip/stats');
            setStats(statsRes.data.data);

            if (activeTab === 'users') {
                const res = await axios.get('/admin/vip/users?limit=50');
                setUsers(res.data.data);
            } else {
                const res = await axios.get('/admin/vip/transactions?limit=50');
                setTransactions(res.data.data);
            }
        } catch (err) {
            console.error('Lỗi lấy dữ liệu VIP', err);
        } finally {
            setLoading(false);
        }
    };

    const handleGrantVip = async () => {
        if (!grantUserId || !grantDuration) return alert("Vui lòng nhập ID người dùng và số ngày");
        try {
            await axios.post(`/admin/vip/users/${grantUserId}/grant`, {
                durationDays: parseInt(grantDuration),
                reason: grantReason
            });
            setShowGrantModal(false);
            setGrantUserId('');
            setGrantReason('');
            alert('Cấp VIP thành công');
            fetchData();
        } catch (err: any) {
            alert(err.response?.data?.message || 'Lỗi cấp VIP');
        }
    };

    const handleRevokeVip = async (uId: number) => {
        if (!confirm('Chắc chắn hủy VIP của user này?')) return;
        try {
            await axios.post(`/admin/vip/users/${uId}/revoke`);
            alert('Đã hủy VIP');
            fetchData();
        } catch (err: any) {
            alert(err.response?.data?.message || 'Lỗi hủy VIP');
        }
    };

    if (loading && !stats.active_vip) {
        return <div className="p-8 text-center">Đang tải dữ liệu VIP...</div>;
    }

    return (
        <div className="min-h-screen bg-gray-50 pb-12">
            <header className="bg-white shadow-sm border-b px-6 py-4 flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-black bg-gradient-to-r from-yellow-500 to-yellow-600 bg-clip-text text-transparent flex items-center gap-2">
                        <FaCrown /> Quản lý VIP & Doanh thu
                    </h1>
                    <p className="text-gray-500 text-sm mt-1">Cấp phát VIP, theo dõi dòng tiền và gói cước</p>
                </div>
                <div className="flex gap-3">
                    <button onClick={() => setShowGrantModal(true)} className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white font-bold rounded-lg transition-colors flex items-center gap-2">
                         <FaCrown /> Cấp VIP thủ công
                    </button>
                    <button onClick={() => router.push('/admin')} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-lg transition-colors">
                        Quay lại
                    </button>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-6 py-6 space-y-6">
                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-white p-5 rounded-xl border shadow-sm">
                        <div className="flex items-center gap-3 mb-2 text-gray-500 text-sm font-semibold"><FiUsers className="text-blue-500"/> VIP Đang hoạt động</div>
                        <div className="text-2xl font-black text-gray-900">{stats.active_vip?.toLocaleString() || 0}</div>
                    </div>
                    <div className="bg-white p-5 rounded-xl border shadow-sm">
                        <div className="flex items-center gap-3 mb-2 text-gray-500 text-sm font-semibold"><FiDollarSign className="text-green-500"/> Tổng doanh thu</div>
                        <div className="text-2xl font-black text-gray-900">{(stats.total_revenue || 0).toLocaleString()} ₫</div>
                    </div>
                    <div className="bg-white p-5 rounded-xl border shadow-sm">
                        <div className="flex items-center gap-3 mb-2 text-gray-500 text-sm font-semibold"><FiActivity className="text-purple-500"/> Doanh thu 30 ngày</div>
                        <div className="text-2xl font-black text-gray-900">{(stats.last_30d_revenue || 0).toLocaleString()} ₫</div>
                    </div>
                    <div className="bg-white p-5 rounded-xl border shadow-sm">
                        <div className="flex items-center gap-3 mb-2 text-gray-500 text-sm font-semibold"><FiCheckCircle className="text-emerald-500"/> Giao dịch thành công</div>
                        <div className="text-2xl font-black text-gray-900">{stats.completed_count?.toLocaleString() || 0}</div>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-4 border-b">
                    <button 
                        onClick={() => setActiveTab('users')}
                        className={`px-4 py-2 font-bold transition-colors ${activeTab === 'users' ? 'text-yellow-600 border-b-2 border-yellow-600' : 'text-gray-500 hover:text-gray-800'}`}
                    >
                        Danh sách VIP
                    </button>
                    <button 
                        onClick={() => setActiveTab('transactions')}
                        className={`px-4 py-2 font-bold transition-colors ${activeTab === 'transactions' ? 'text-yellow-600 border-b-2 border-yellow-600' : 'text-gray-500 hover:text-gray-800'}`}
                    >
                        Lịch sử Giao dịch
                    </button>
                </div>

                {/* Tab: Users */}
                {activeTab === 'users' && (
                    <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-gray-50 border-b">
                                <tr>
                                    <th className="p-4 font-semibold text-gray-600">User ID</th>
                                    <th className="p-4 font-semibold text-gray-600">Thông tin</th>
                                    <th className="p-4 font-semibold text-gray-600">Trạng thái VIP</th>
                                    <th className="p-4 font-semibold text-gray-600">Ngày hết hạn</th>
                                    <th className="p-4 font-semibold text-gray-600">Chi tiêu</th>
                                    <th className="p-4 font-semibold text-gray-600 text-right">Hành động</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {users.map(u => {
                                    const isExpired = new Date(u.vip_expires_at) < new Date();
                                    return (
                                        <tr key={u.id} className="hover:bg-gray-50">
                                            <td className="p-4">#{u.id}</td>
                                            <td className="p-4">
                                                <div className="font-bold text-gray-900">{u.full_name}</div>
                                                <div className="text-gray-500 text-xs">{u.email}</div>
                                            </td>
                                            <td className="p-4">
                                                {u.is_vip ? (
                                                    isExpired 
                                                    ? <span className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-bold">Hết hạn</span>
                                                    : <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded text-xs font-bold flex items-center gap-1 w-max"><FaCrown/> Active</span>
                                                ) : <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs font-bold">Không VIP</span>}
                                            </td>
                                            <td className="p-4 text-gray-600">{u.vip_expires_at ? new Date(u.vip_expires_at).toLocaleDateString('vi-VN') : '—'}</td>
                                            <td className="p-4 font-bold text-green-600">{u.total_paid ? `${parseInt(u.total_paid).toLocaleString()} ₫` : '0 ₫'}</td>
                                            <td className="p-4 text-right">
                                                {u.is_vip && !isExpired && (
                                                    <button onClick={() => handleRevokeVip(u.id)} className="text-red-500 hover:text-red-700 text-xs font-bold uppercase transition-colors">
                                                        Thu hồi
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                        {users.length === 0 && <p className="p-8 text-center text-gray-500">Chưa có dữ liệu</p>}
                    </div>
                )}

                {/* Tab: Transactions */}
                {activeTab === 'transactions' && (
                    <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-gray-50 border-b">
                                <tr>
                                    <th className="p-4 font-semibold text-gray-600">Thời gian</th>
                                    <th className="p-4 font-semibold text-gray-600">Mã GD</th>
                                    <th className="p-4 font-semibold text-gray-600">User</th>
                                    <th className="p-4 font-semibold text-gray-600">Gói (Ngày)</th>
                                    <th className="p-4 font-semibold text-gray-600">Số tiền</th>
                                    <th className="p-4 font-semibold text-gray-600">Phương thức</th>
                                    <th className="p-4 font-semibold text-gray-600">Trạng thái</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {transactions.map(t => (
                                    <tr key={t.id} className="hover:bg-gray-50">
                                        <td className="p-4 text-gray-600">{new Date(t.created_at).toLocaleString('vi-VN')}</td>
                                        <td className="p-4 font-mono text-xs text-gray-500">{t.transaction_code}</td>
                                        <td className="p-4 font-semibold text-gray-900">{t.email || `#${t.user_id}`}</td>
                                        <td className="p-4">{t.package_duration}</td>
                                        <td className="p-4 font-bold text-gray-900">{parseInt(t.amount).toLocaleString()} ₫</td>
                                        <td className="p-4"><span className="uppercase text-xs font-bold text-gray-500 bg-gray-100 px-2 py-1 rounded">{t.payment_method}</span></td>
                                        <td className="p-4">
                                            {t.status === 'completed' ? <span className="text-green-600 font-bold bg-green-50 px-2 py-1 rounded text-xs flex items-center gap-1 w-max"><FiCheckCircle/> Thành công</span> :
                                             t.status === 'failed' ? <span className="text-red-600 font-bold bg-red-50 px-2 py-1 rounded text-xs flex items-center gap-1 w-max"><FiXCircle/> Thất bại</span> :
                                             <span className="text-yellow-600 font-bold bg-yellow-50 px-2 py-1 rounded text-xs flex items-center gap-1 w-max"><FiClock/> Chờ thanh toán</span>}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {transactions.length === 0 && <p className="p-8 text-center text-gray-500">Chưa có giao dịch nào</p>}
                    </div>
                )}
            </main>

            {/* Modal grant VIP */}
            {showGrantModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl">
                        <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-gray-900"><FaCrown className="text-yellow-500"/> Cấp VIP Thủ Công</h2>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">User ID *</label>
                                <input type="number" value={grantUserId} onChange={e=>setGrantUserId(e.target.value)} className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-yellow-500 outline-none" placeholder="VD: 5" />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Thời hạn (Ngày) *</label>
                                <input type="number" value={grantDuration} onChange={e=>setGrantDuration(e.target.value)} className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-yellow-500 outline-none" placeholder="30" />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Lý do</label>
                                <input type="text" value={grantReason} onChange={e=>setGrantReason(e.target.value)} className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-yellow-500 outline-none" placeholder="Event tặng thưởng..." />
                            </div>
                        </div>
                        <div className="mt-6 flex gap-3 justify-end">
                            <button onClick={()=>setShowGrantModal(false)} className="px-4 py-2 text-gray-600 font-semibold hover:bg-gray-100 rounded-lg">Hủy</button>
                            <button onClick={handleGrantVip} className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white font-bold rounded-lg shadow">Xác nhận cấp VIP</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
