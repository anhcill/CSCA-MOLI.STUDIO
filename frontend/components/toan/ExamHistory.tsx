'use client';

import { useState, useEffect } from 'react';
import { FiCheckCircle, FiXCircle, FiClock } from 'react-icons/fi';
import Link from 'next/link';
import examApi from '@/lib/api/exams';

interface ExamHistoryProps {
  subjectCode: string;
}

export default function ExamHistory({ subjectCode }: ExamHistoryProps) {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadHistory();
  }, [subjectCode]);

  const loadHistory = async () => {
    try {
      setLoading(true);
      const data = await examApi.getHistory(subjectCode, 10);
      setHistory(data);
    } catch (error) {
      console.error('Error loading history:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'excellent': return 'bg-green-500';
      case 'good': return 'bg-blue-500';
      case 'average': return 'bg-yellow-500';
      case 'poor': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  // Score is on 0-10 scale
  const getStatusText = (score: number) => {
    if (score >= 8) return 'Xuất sắc';
    if (score >= 7) return 'Khá';
    if (score >= 5) return 'Trung bình';
    return 'Yếu';
  };

  return (
    <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-6">
      <h3 className="text-xl font-bold text-gray-900 mb-5">Lịch sử làm bài</h3>

      {/* Learning Statistics */}
      <div className="mb-6 space-y-3">
        <p className="text-sm font-semibold text-gray-700 mb-3">Thống kê học tập:</p>

        {/* Total Exams */}
        <div className="flex items-center p-3 bg-purple-50 rounded-lg">
          <div className="w-10 h-10 bg-purple-600 rounded-lg flex items-center justify-center mr-3">
            <span className="text-white text-xl">📝</span>
          </div>
          <div className="flex-1">
            <p className="text-xs text-gray-600">Tổng bài đã làm</p>
            <p className="text-lg font-bold text-gray-900">{history.length} bài</p>
          </div>
        </div>

        {/* Average Score */}
        <div className="flex items-center p-3 bg-green-50 rounded-lg">
          <div className="w-10 h-10 bg-green-600 rounded-lg flex items-center justify-center mr-3">
            <span className="text-white text-xl">🎯</span>
          </div>
          <div className="flex-1">
            <p className="text-xs text-gray-600">Điểm trung bình</p>
            <p className="text-lg font-bold text-gray-900">
              {history.length > 0
                ? (history.reduce((sum, item) => sum + (Number(item.total_score) || 0), 0) / history.length).toFixed(1)
                : '0'}/10
            </p>
          </div>
        </div>

        {/* Streak */}
        <div className="flex items-center p-3 bg-orange-50 rounded-lg">
          <div className="w-10 h-10 bg-orange-600 rounded-lg flex items-center justify-center mr-3">
            <span className="text-white text-xl">🔥</span>
          </div>
          <div className="flex-1">
            <p className="text-xs text-gray-600">Chuỗi ngày học</p>
            <p className="text-lg font-bold text-gray-900">7 ngày</p>
          </div>
        </div>

        {/* Study Time */}
        <div className="flex items-center p-3 bg-blue-50 rounded-lg">
          <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center mr-3">
            <span className="text-white text-xl">⏱️</span>
          </div>
          <div className="flex-1">
            <p className="text-xs text-gray-600">Thời gian học</p>
            <p className="text-lg font-bold text-gray-900">
              {history.length > 0 ? Math.round(history.length * 0.5) : 0} giờ
            </p>
          </div>
        </div>
      </div>

      {/* Detailed History List */}
      <div className="space-y-3">
        {loading ? (
          <div className="text-center py-8">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : history.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            Chưa có lịch sử làm bài
          </div>
        ) : history.map((item, index) => (
          <button
            key={index}
            onClick={() => window.location.href = `/exam/result/${item.id}`}
            className="w-full border border-gray-200 rounded-xl p-4 hover:shadow-md hover:border-blue-300 transition-all cursor-pointer text-left"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <div className="flex items-center space-x-3 mb-2">
                  <h4 className="text-base font-bold text-gray-900">{item.exam_title}</h4>
                  <span className={`px-2 py-1 ${getStatusColor(Number(item.total_score) >= 8 ? 'excellent' : Number(item.total_score) >= 7 ? 'good' : Number(item.total_score) >= 5 ? 'average' : 'poor')} text-white text-xs font-semibold rounded-full`}>
                    {getStatusText(Number(item.total_score) || 0)}
                  </span>
                </div>
                <div className="flex items-center space-x-2 text-sm text-gray-500">
                  <FiClock size={14} />
                  <span>{new Date(item.submit_time).toLocaleDateString('vi-VN')}</span>
                </div>
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold text-blue-600">{(Number(item.total_score) || 0).toFixed(1)}</p>
                <p className="text-xs text-gray-500">/ 10</p>
              </div>
            </div>

            <div className="flex items-center space-x-4 text-sm">
              <div className="flex items-center space-x-2 text-green-600">
                <FiCheckCircle size={16} />
                <span className="font-semibold">Đúng: {item.total_correct}</span>
              </div>
              <div className="flex items-center space-x-2 text-red-600">
                <FiXCircle size={16} />
                <span className="font-semibold">Sai: {item.total_incorrect}</span>
              </div>
              <div className="flex items-center space-x-2 text-gray-600">
                <span className="font-semibold">Bỏ qua: {item.total_unanswered}</span>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="mt-3 w-full bg-gray-100 rounded-full h-2 overflow-hidden">
              <div
                className={`h-full ${getStatusColor(item.total_score >= 80 ? 'excellent' : item.total_score >= 70 ? 'good' : 'average')} transition-all duration-500`}
                style={{ width: `${(item.total_correct / (item.total_correct + item.total_incorrect + item.total_unanswered)) * 100}%` }}
              ></div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
