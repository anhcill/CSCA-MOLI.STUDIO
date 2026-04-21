'use client';

import { useState } from 'react';
import Header from '@/components/layout/Header';
import { FiMapPin, FiMail, FiPhone, FiFacebook, FiYoutube, FiInstagram, FiSend, FiMessageCircle } from 'react-icons/fi';

interface FormData {
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
}

interface FormErrors {
  name?: string;
  email?: string;
  message?: string;
}

const CONTACT_CHANNELS = [
  {
    icon: FiMail,
    label: 'Email',
    value: 'support@csca.edu.vn',
    href: 'mailto:support@csca.edu.vn',
    color: 'text-red-500 bg-red-50 border-red-100',
    hover: 'hover:bg-red-50',
  },
  {
    icon: FiPhone,
    label: 'Điện thoại',
    value: '0812 352 005',
    href: 'tel:+840812352005',
    color: 'text-emerald-500 bg-emerald-50 border-emerald-100',
    hover: 'hover:bg-emerald-50',
  },
  {
    icon: FiMessageCircle,
    label: 'Zalo',
    value: '0812 352 005',
    href: 'https://zalo.me/0812352005',
    color: 'text-blue-500 bg-blue-50 border-blue-100',
    hover: 'hover:bg-blue-50',
  },
  {
    icon: FiFacebook,
    label: 'Facebook',
    value: 'fb.com/csca.edu.vn',
    href: 'https://www.facebook.com/share/1awx75D2rm/?mibextid=wwXIfr',
    color: 'text-blue-600 bg-blue-50 border-blue-100',
    hover: 'hover:bg-blue-50',
  },
  {
    icon: FiYoutube,
    label: 'YouTube',
    value: 'youtube.com/@csca',
    href: 'https://youtube.com',
    color: 'text-red-600 bg-red-50 border-red-100',
    hover: 'hover:bg-red-50',
  },
  {
    icon: FiInstagram,
    label: 'TikTok',
    value: '@cloudly_studio',
    href: 'https://www.tiktok.com/@cloudly_studio',
    color: 'text-pink-500 bg-pink-50 border-pink-100',
    hover: 'hover:bg-pink-50',
  },
];

const SUBJECTS = [
  'Tư vấn khóa học',
  'Kỹ thuật / Báo lỗi',
  'Thanh toán & Hoàn tiền',
  'Nội dung & Tài liệu',
  'Hợp tác & Đối tác',
  'Khác',
];

function validate(data: FormData): FormErrors {
  const errors: FormErrors = {};
  if (!data.name.trim()) errors.name = 'Vui lòng nhập họ và tên.';
  if (!data.email.trim()) errors.email = 'Vui lòng nhập email.';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) errors.email = 'Email không hợp lệ.';
  if (!data.message.trim()) errors.message = 'Vui lòng nhập nội dung tin nhắn.';
  return errors;
}

export default function ContactPage() {
  const [form, setForm] = useState<FormData>({ name: '', email: '', phone: '', subject: 'Tư vấn khóa học', message: '' });
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleChange = (field: keyof FormData, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
    if (errors[field as keyof FormErrors]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate(form);
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    setLoading(true);
    await new Promise(r => setTimeout(r, 1200));
    setLoading(false);
    setSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
        {/* Hero */}
        <div className="mb-10 flex items-center gap-4">
          <div className="w-14 h-14 bg-purple-100 rounded-2xl flex items-center justify-center shrink-0">
            <FiMessageCircle className="text-purple-600" size={26} />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Liên hệ CSCA</h1>
            <p className="text-sm text-gray-500 mt-1">Đội ngũ CSCA luôn sẵn sàng hỗ trợ bạn 24/7</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* Contact channels */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-gradient-to-br from-purple-600 to-indigo-600 rounded-2xl p-6 text-white">
              <h2 className="font-bold text-lg mb-1">Kênh liên hệ</h2>
              <p className="text-purple-200 text-sm mb-5">Chọn kênh phù hợp với bạn</p>
              <div className="space-y-3">
                {CONTACT_CHANNELS.map(ch => (
                  <a
                    key={ch.label}
                    href={ch.href}
                    target={ch.href.startsWith('tel:') ? undefined : '_blank'}
                    rel={ch.href.startsWith('tel:') ? undefined : 'noopener noreferrer'}
                    className={`flex items-center gap-3 p-3 rounded-xl border transition-colors bg-white/10 border-white/20 ${ch.hover}`}
                  >
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${ch.color}`}>
                      <ch.icon size={17} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-purple-200 font-medium">{ch.label}</p>
                      <p className="text-sm font-semibold text-white truncate">{ch.value}</p>
                    </div>
                  </a>
                ))}
              </div>
            </div>

            {/* Office info */}
            <div className="bg-white border border-gray-200 rounded-2xl p-5">
              <h3 className="font-bold text-gray-900 mb-3">Văn phòng CSCA</h3>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center shrink-0">
                    <FiMapPin className="text-gray-500" size={15} />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 font-medium">Địa chỉ</p>
                    <p className="text-sm text-gray-800">Hà Nội, Việt Nam</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center shrink-0">
                    <FiMail className="text-gray-500" size={15} />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 font-medium">Hỗ trợ</p>
                    <p className="text-sm text-gray-800">support@csca.edu.vn</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center shrink-0">
                    <FiPhone className="text-gray-500" size={15} />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 font-medium">Hotline</p>
                    <p className="text-sm text-gray-800">0812 352 005</p>
                  </div>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-xs text-gray-500">
                  Thời gian hỗ trợ: <span className="font-semibold text-gray-700">Thứ 2 – Thứ 6, 8:00 – 18:00</span>
                </p>
                <p className="text-xs text-gray-400 mt-0.5">Email và Zalo: Phản hồi trong 24 giờ làm việc</p>
              </div>
            </div>
          </div>

          {/* Contact Form */}
          <div className="lg:col-span-3">
            <div className="bg-white border border-gray-200 rounded-2xl p-6">
              <h2 className="font-bold text-gray-900 text-lg mb-1">Gửi tin nhắn</h2>
              <p className="text-sm text-gray-500 mb-6">Điền thông tin bên dưới, chúng tôi sẽ phản hồi sớm nhất có thể</p>

              {submitted ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <FiSend className="text-emerald-500" size={28} />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">Gửi tin nhắn thành công!</h3>
                  <p className="text-sm text-gray-500 mb-6">
                    Cảm ơn bạn đã liên hệ. Đội ngũ CSCA sẽ phản hồi qua email <strong>{form.email}</strong> trong vòng 24 giờ.
                  </p>
                  <button
                    onClick={() => { setSubmitted(false); setForm({ name: '', email: '', phone: '', subject: 'Tư vấn khóa học', message: '' }); }}
                    className="px-5 py-2.5 bg-purple-600 text-white rounded-lg text-sm font-semibold hover:bg-purple-700 transition-colors"
                  >
                    Gửi tin nhắn khác
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        Họ và tên <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="Nguyễn Văn A"
                        value={form.name}
                        onChange={e => handleChange('name', e.target.value)}
                        className={`w-full px-4 py-2.5 border rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-400 transition-colors ${errors.name ? 'border-red-400 bg-red-50' : 'border-gray-200'}`}
                      />
                      {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        Email <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="email"
                        placeholder="email@example.com"
                        value={form.email}
                        onChange={e => handleChange('email', e.target.value)}
                        className={`w-full px-4 py-2.5 border rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-400 transition-colors ${errors.email ? 'border-red-400 bg-red-50' : 'border-gray-200'}`}
                      />
                      {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Số điện thoại</label>
                      <input
                        type="tel"
                        placeholder="09xx xxx xxx"
                        value={form.phone}
                        onChange={e => handleChange('phone', e.target.value)}
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-400 transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Chủ đề</label>
                      <select
                        value={form.subject}
                        onChange={e => handleChange('subject', e.target.value)}
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-400 transition-colors appearance-none cursor-pointer"
                      >
                        {SUBJECTS.map(s => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Nội dung tin nhắn <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      placeholder="Mô tả chi tiết vấn đề hoặc câu hỏi của bạn..."
                      rows={5}
                      value={form.message}
                      onChange={e => handleChange('message', e.target.value)}
                      className={`w-full px-4 py-3 border rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-400 transition-colors resize-none ${errors.message ? 'border-red-400 bg-red-50' : 'border-gray-200'}`}
                    />
                    {errors.message && <p className="text-xs text-red-500 mt-1">{errors.message}</p>}
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 bg-purple-600 text-white rounded-xl font-semibold text-sm hover:bg-purple-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Đang gửi...
                      </>
                    ) : (
                      <>
                        <FiSend size={16} />
                        Gửi tin nhắn
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
