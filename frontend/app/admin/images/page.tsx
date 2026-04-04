'use client';

import { useState, useEffect, useRef } from 'react';
import { FiUpload, FiCopy, FiTrash2, FiCheck, FiImage } from 'react-icons/fi';
import { imageApi } from '@/lib/api/imageApi';

interface UploadedImage {
    filename: string;
    url: string;
    size: number;
    uploadedAt: string;
}

export default function ImageManagerPage() {
    const [images, setImages] = useState<UploadedImage[]>([]);
    const [uploading, setUploading] = useState(false);
    const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        loadImages();
    }, []);

    const loadImages = async () => {
        try {
            console.log('Loading images...');
            const response = await imageApi.getImages();
            console.log('Images response:', response);

            if (response.success) {
                console.log('Images loaded:', response.data);
                setImages(response.data);
            }
        } catch (error) {
            console.error('Failed to load images:', error);
        }
    };

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        await uploadFiles(Array.from(files));
    };

    const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        const files = e.dataTransfer.files;
        if (!files || files.length === 0) return;

        await uploadFiles(Array.from(files));
    };

    const uploadFiles = async (files: File[]) => {
        setUploading(true);
        try {
            console.log('Uploading files:', files);
            const response = await imageApi.uploadImages(files);
            console.log('Upload response:', response);

            if (response.success) {
                alert(`Upload thành công ${response.data.length} ảnh!`);
                await loadImages();
                if (fileInputRef.current) {
                    fileInputRef.current.value = '';
                }
            }
        } catch (error: any) {
            console.error('Upload failed:', error);
            alert(`Upload thất bại: ${error.response?.data?.message || error.message}`);
        } finally {
            setUploading(false);
        }
    };

    const copyUrl = (url: string) => {
        const fullUrl = `${window.location.origin}${url}`;
        navigator.clipboard.writeText(fullUrl);
        setCopiedUrl(url);
        setTimeout(() => setCopiedUrl(null), 2000);
    };

    const deleteImage = async (filename: string) => {
        if (!confirm('Xóa ảnh này?')) return;

        try {
            await imageApi.deleteImage(filename);
            await loadImages();
        } catch (error) {
            console.error('Delete failed:', error);
            alert('Xóa ảnh thất bại.');
        }
    };

    const formatFileSize = (bytes: number) => {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    };

    return (
        <div className="min-h-screen bg-gray-50 p-8">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">Quản lý Hình ảnh</h1>
                    <p className="text-gray-600">Upload ảnh để sử dụng trong đề thi Excel</p>
                </div>

                {/* Upload Area */}
                <div
                    className="bg-white rounded-xl shadow-sm border-2 border-dashed border-gray-300 p-12 mb-8 text-center hover:border-blue-500 transition-colors"
                    onDrop={handleDrop}
                    onDragOver={(e) => e.preventDefault()}
                >
                    <FiUpload className="mx-auto text-5xl text-gray-400 mb-4" />
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">
                        Kéo thả ảnh vào đây
                    </h3>
                    <p className="text-gray-600 mb-4">hoặc</p>
                    <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        accept="image/*"
                        onChange={handleFileSelect}
                        className="hidden"
                        id="file-upload"
                    />
                    <label
                        htmlFor="file-upload"
                        className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 cursor-pointer"
                    >
                        Chọn file từ máy tính
                    </label>
                    <p className="text-sm text-gray-500 mt-4">
                        Hỗ trợ: JPG, PNG, GIF, WebP (tối đa 5MB/ảnh, 20 ảnh cùng lúc)
                    </p>
                    {uploading && (
                        <div className="mt-4">
                            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                            <p className="text-blue-600 mt-2">Đang upload...</p>
                        </div>
                    )}
                </div>

                {/* Images Grid */}
                <div className="bg-white rounded-xl shadow-sm p-6">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-xl font-semibold text-gray-900">
                            Ảnh đã upload ({images.length})
                        </h2>
                    </div>

                    {images.length === 0 ? (
                        <div className="text-center py-12">
                            <FiImage className="mx-auto text-6xl text-gray-300 mb-4" />
                            <p className="text-gray-500">Chưa có ảnh nào. Upload ảnh để bắt đầu!</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                            {images.map((image) => (
                                <div
                                    key={image.filename}
                                    className="border rounded-lg overflow-hidden hover:shadow-lg transition-shadow"
                                >
                                    {/* Image Preview */}
                                    <div className="aspect-video bg-gray-100 relative">
                                        <img
                                            src={image.url}
                                            alt={image.filename}
                                            className="w-full h-full object-cover"
                                        />
                                    </div>

                                    {/* Image Info */}
                                    <div className="p-3">
                                        <p className="text-xs text-gray-500 truncate mb-2">
                                            {image.filename}
                                        </p>
                                        <p className="text-xs text-gray-400 mb-3">
                                            {formatFileSize(image.size)}
                                        </p>

                                        {/* Actions */}
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => copyUrl(image.url)}
                                                className={`flex-1 px-3 py-2 rounded-lg font-medium text-sm flex items-center justify-center gap-2 transition-colors ${copiedUrl === image.url
                                                    ? 'bg-green-100 text-green-700'
                                                    : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                                                    }`}
                                            >
                                                {copiedUrl === image.url ? (
                                                    <>
                                                        <FiCheck /> Copied!
                                                    </>
                                                ) : (
                                                    <>
                                                        <FiCopy /> Copy URL
                                                    </>
                                                )}
                                            </button>
                                            <button
                                                onClick={() => deleteImage(image.filename)}
                                                className="px-3 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
                                            >
                                                <FiTrash2 />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
