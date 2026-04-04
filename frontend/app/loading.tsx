import PageSkeleton from '@/components/layout/PageSkeleton';

// Root-level loading — applies to ALL routes that don't have their own loading.tsx
export default function Loading() {
    return <PageSkeleton />;
}
