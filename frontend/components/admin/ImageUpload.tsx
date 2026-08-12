'use client';

import { useState, useCallback, useEffect, useId } from 'react';
import { FiX, FiImage, FiAlertCircle, FiClipboard } from 'react-icons/fi';
import axios from '@/lib/utils/axios';

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

interface ImageUploadProps {
    onImageUploaded: (url: string) => void;
    currentImage?: string;
    label?: string;
    compact?: boolean;
}

export default function ImageUpload({ onImageUploaded, currentImage, label = 'Upload Image', compact = false }: ImageUploadProps) {
    const [uploading, setUploading] = useState(false);
    const [dragActive, setDragActive] = useState(false);
    const [preview, setPreview] = useState<string | undefined>(currentImage);
    const [error, setError] = useState<string | null>(null);
    const inputId = useId();

    useEffect(() => {
        setPreview(currentImage);
    }, [currentImage]);

    const uploadImage = useCallback(async (file: File) => {
        if (uploading) return;

        if (!file.type.startsWith('image/')) {
            setError('Vui lòng chọn hoặc dán một tệp ảnh hợp lệ');
            return;
        }

        if (file.size > MAX_IMAGE_SIZE) {
            setError('Ảnh vượt quá dung lượng tối đa 5MB');
            return;
        }

        try {
            setUploading(true);
            setError(null);

            const formData = new FormData();
            formData.append('image', file);

            const response = await axios.post('/admin/images/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            // Backend returns full HTTPS URL from Cloudinary (e.g. https://res.cloudinary.com/...)
            // Use it directly without any prefix concatenation
            const imageUrl = response.data.data.url;
            setPreview(imageUrl);
            onImageUploaded(imageUrl);
        } catch (err: any) {
            const message = err.response?.data?.message || 'Upload ảnh thất bại';
            setError(message);
            console.error('Upload error:', err);
        } finally {
            setUploading(false);
        }
    }, [onImageUploaded, uploading]);


    const handleDrag = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === 'dragenter' || e.type === 'dragover') {
            setDragActive(true);
        } else if (e.type === 'dragleave') {
            setDragActive(false);
        }
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);

        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            void uploadImage(e.dataTransfer.files[0]);
        }
    }, [uploadImage]);

    const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            void uploadImage(e.target.files[0]);
        }
        e.target.value = '';
    };

    const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
        const imageItem = Array.from(e.clipboardData.items)
            .find(item => item.type.startsWith('image/'));
        const file = imageItem?.getAsFile();
        if (!file) return;

        e.preventDefault();
        void uploadImage(file);
    };

    const removeImage = () => {
        setPreview(undefined);
        onImageUploaded('');
    };

    return (
        <div
            tabIndex={0}
            onPaste={handlePaste}
            className="space-y-2 rounded-lg outline-none focus:ring-2 focus:ring-blue-100"
        >
            {label && <label className="block text-sm font-medium text-gray-700">{label}</label>}

            {/* Error message */}
            {error && (
                <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                    <FiAlertCircle size={14} className="shrink-0" />
                    <span>{error}</span>
                    <button type="button" onClick={() => setError(null)} className="ml-auto"><FiX size={14} /></button>
                </div>
            )}

            {preview ? (
                <div>
                    <div className="relative group w-fit max-w-full">
                        <img
                            src={preview}
                            alt="Preview"
                            className={`${compact ? 'max-h-32 max-w-full' : 'max-w-xs'} rounded-lg border-2 border-gray-200 object-contain`}
                        />
                        <button
                            type="button"
                            onClick={removeImage}
                            className="absolute top-2 right-2 bg-red-500 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                            <FiX size={16} />
                        </button>
                    </div>
                    <button
                        type="button"
                        disabled={uploading}
                        className="mt-2 flex items-center gap-1.5 rounded px-1 py-0.5 text-left text-xs text-gray-500 outline-none hover:bg-gray-50 focus:ring-2 focus:ring-blue-100 disabled:opacity-60"
                    >
                        <FiClipboard size={13} />
                        {uploading ? 'Đang upload ảnh...' : 'Bấm đây rồi nhấn Ctrl+V để thay bằng ảnh trong clipboard'}
                    </button>
                </div>
            ) : (
                <div
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                    className={`border-2 border-dashed rounded-lg ${compact ? 'p-4' : 'p-8'} text-center transition-colors ${dragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
                        }`}
                >
                    <input
                        type="file"
                        id={`file-upload-${inputId}`}
                        className="hidden"
                        accept="image/*"
                        onChange={handleFileInput}
                        disabled={uploading}
                    />

                    <label
                        htmlFor={`file-upload-${inputId}`}
                        className="cursor-pointer flex flex-col items-center space-y-2"
                    >
                        {uploading ? (
                            <>
                                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                                <p className="text-sm text-gray-600">Đang upload...</p>
                            </>
                        ) : (
                            <>
                                <FiImage className="text-gray-400" size={compact ? 28 : 48} />
                                <div className="text-sm text-gray-600">
                                    <span className="font-semibold text-blue-600">Click để chọn ảnh</span>, kéo thả hoặc nhấn Ctrl+V
                                </div>
                                <p className="text-xs text-gray-500">PNG, JPG, GIF, WebP tối đa 5MB</p>
                            </>
                        )}
                    </label>
                    {!uploading && (
                        <button
                            type="button"
                            className="mx-auto mt-3 inline-flex items-center gap-1.5 rounded-md border border-blue-100 bg-blue-50 px-2.5 py-1.5 text-xs font-semibold text-blue-700 outline-none hover:bg-blue-100 focus:ring-2 focus:ring-blue-200"
                        >
                            <FiClipboard size={13} />
                            Bấm đây rồi nhấn Ctrl+V để dán ảnh
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}

