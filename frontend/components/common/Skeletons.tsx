/**
 * Loading Skeletons - Reusable loading states
 */

export function PostSkeleton() {
  return (
    <div className="bg-white rounded-xl p-6 border border-gray-100 animate-pulse">
      <div className="flex items-start gap-3 mb-4">
        <div className="w-10 h-10 bg-gray-200 rounded-full" />
        <div className="flex-1">
          <div className="h-4 bg-gray-200 rounded w-32 mb-2" />
          <div className="h-3 bg-gray-100 rounded w-24" />
        </div>
      </div>
      <div className="space-y-2 mb-4">
        <div className="h-4 bg-gray-100 rounded w-full" />
        <div className="h-4 bg-gray-100 rounded w-5/6" />
        <div className="h-4 bg-gray-100 rounded w-4/6" />
      </div>
      <div className="flex gap-4">
        <div className="h-8 bg-gray-100 rounded w-16" />
        <div className="h-8 bg-gray-100 rounded w-16" />
      </div>
    </div>
  );
}

export function MaterialCardSkeleton() {
  return (
    <div className="bg-white border border-gray-100 rounded-xl p-4 animate-pulse">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 bg-gray-200 rounded-lg" />
        <div className="flex-1">
          <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
          <div className="h-3 bg-gray-100 rounded w-1/2 mb-2" />
          <div className="flex gap-2">
            <div className="h-5 bg-gray-100 rounded-full w-16" />
            <div className="h-5 bg-gray-100 rounded-full w-16" />
          </div>
        </div>
        <div className="flex gap-2">
          <div className="h-8 bg-gray-100 rounded-lg w-16" />
          <div className="h-8 bg-gray-100 rounded-lg w-10" />
        </div>
      </div>
    </div>
  );
}

export function ExamCardSkeleton() {
  return (
    <div className="bg-white rounded-xl p-6 border border-gray-100 hover:shadow-lg transition-all animate-pulse">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="h-5 bg-gray-200 rounded w-48 mb-2" />
          <div className="h-4 bg-gray-100 rounded w-32" />
        </div>
        <div className="w-16 h-16 bg-gray-200 rounded-xl" />
      </div>
      <div className="flex items-center gap-4 mb-4">
        <div className="h-4 bg-gray-100 rounded w-24" />
        <div className="h-4 bg-gray-100 rounded w-24" />
      </div>
      <div className="h-10 bg-gray-200 rounded-lg w-full" />
    </div>
  );
}

export function ProfileStatSkeleton() {
  return (
    <div className="bg-white rounded-xl p-4 border border-gray-100 animate-pulse">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 bg-gray-200 rounded-lg" />
        <div className="h-4 bg-gray-200 rounded w-20" />
      </div>
      <div className="h-8 bg-gray-100 rounded w-16" />
    </div>
  );
}

export function TableRowSkeleton({ cols = 5 }: { cols?: number }) {
  return (
    <tr className="animate-pulse">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 bg-gray-100 rounded w-full" />
        </td>
      ))}
    </tr>
  );
}
