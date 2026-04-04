export default function PageSkeleton() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-white">
            <div className="relative w-10 h-10">
                <div className="absolute inset-0 rounded-full border-4 border-gray-100" />
                <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-indigo-500 animate-spin" />
            </div>
        </div>
    );
}
