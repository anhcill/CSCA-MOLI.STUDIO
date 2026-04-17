const fs = require('fs');
const content = fs.readFileSync('app/admin/page.tsx', 'utf8');
const lines = content.split('\n');

const startIndex = lines.findIndex(l => l.includes("color: 'from-orange-500 to-orange-600',"));
console.log('Start index:', startIndex);

if (startIndex !== -1) {
    const insertBlock = `            bgColor: 'bg-orange-50',
            textColor: 'text-orange-600'
        }
    ];

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <header className="bg-white shadow-sm border-b">
                <div className="max-w-7xl mx-auto px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-3xl font-black bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                                Admin Dashboard
                            </h1>
                            <p className="text-gray-600 mt-1">Quản lý hệ thống CSCA</p>
                        </div>
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => router.push('/')}
                                className="hidden sm:flex items-center gap-2 px-4 py-2 bg-purple-50 text-purple-700 hover:bg-purple-100 rounded-lg text-sm font-semibold transition-colors"
                            >
                                <span>←</span> Về Trang Khách
                            </button>
                            <div className="text-right border-l pl-4 border-gray-200">
                                <p className="text-sm text-gray-600">Xin chào,</p>
                                <p className="font-semibold text-gray-900">{user?.full_name}</p>
                            </div>
                            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-white font-bold">
                                {user?.full_name?.charAt(0).toUpperCase()}
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-6 py-8">
                {/* Navigation Tabs */}
                <div className="bg-white rounded-xl shadow-sm border mb-6 p-2 flex gap-2 overflow-x-auto">
                    <button className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-semibold whitespace-nowrap">
                        📊 Tổng quan
                    </button>`;
                    
    const canManageIndex = lines.findIndex((l, i) => i > startIndex && l.includes('{canManageUsers && ('));
    console.log('canManageIndex:', canManageIndex);
    
    if (canManageIndex !== -1) {
        lines.splice(startIndex + 1, canManageIndex - startIndex - 1, insertBlock);
        fs.writeFileSync('app/admin/page.tsx', lines.join('\n'));
        console.log('Fixed successfully');
    }
}
