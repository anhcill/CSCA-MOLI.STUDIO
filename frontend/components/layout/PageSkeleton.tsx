export default function PageSkeleton() {
    return (
        <div className="flex-1 min-h-[60vh] flex items-center justify-center bg-transparent">
            <div className="relative w-12 h-12">
                <div className="absolute inset-0 rounded-full border-4 border-indigo-100/50" />
                <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-indigo-500 animate-spin" />
            </div>
        </div>
    );
}
