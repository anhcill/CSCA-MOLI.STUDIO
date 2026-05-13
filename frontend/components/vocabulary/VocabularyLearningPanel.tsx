'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { vocabularyReviewApi, type VocabularyReviewFilters } from '@/lib/api/vocabulary';
import type { VocabularyReviewDashboard } from '@/lib/types/vocabulary';
import FlashcardSession from './FlashcardSession';
import MiniTestPanel from './MiniTestPanel';
import ReviewStatsPanel from './ReviewStatsPanel';

interface Props {
  subject?: string;
  topic?: string;
}

export default function VocabularyLearningPanel({ subject, topic }: Props) {
  const filters = useMemo<VocabularyReviewFilters>(() => ({ subject, topic }), [subject, topic]);
  const [dashboard, setDashboard] = useState<VocabularyReviewDashboard | null>(null);
  const [loading, setLoading] = useState(false);

  const loadDashboard = useCallback(async () => {
    try {
      setLoading(true);
      const data = await vocabularyReviewApi.getDashboard(filters);
      setDashboard(data);
    } catch {
      setDashboard(null);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  return (
    <div className="mb-6 space-y-4">
      <ReviewStatsPanel data={dashboard} loading={loading} onRefresh={loadDashboard} />
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <FlashcardSession filters={filters} onReviewed={loadDashboard} />
        <MiniTestPanel filters={filters} onSubmitted={loadDashboard} />
      </div>
    </div>
  );
}

