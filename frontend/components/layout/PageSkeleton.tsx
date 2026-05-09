export default function PageSkeleton() {
    return (
        <div className="flex-1 min-h-[100dvh] flex items-center justify-center bg-transparent">
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-white/80 backdrop-blur-sm">
                <div className="relative w-12 h-12 -mt-20">
                    <div className="absolute inset-0 rounded-full border-4 border-indigo-100/50" />
                    <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-indigo-500 animate-spin" />
                </div>
            </div>
        </div>
    );
}
