'use client';

import { useState, useCallback } from 'react';
import { FiX, FiImage, FiAlertCircle } from 'react-icons/fi';
import axios from '@/lib/utils/axios';

interface ImageUploadProps {
    onImageUploaded: (url: string) => void;
    currentImage?: string;
    label?: string;
}

export default function ImageUpload({ onImageUploaded, currentImage, label = 'Upload Image' }: ImageUploadProps) {
    const [uploading, setUploading] = useState(false);
    const [dragActive, setDragActive] = useState(false);
    const [preview, setPreview] = useState<string | undefined>(currentImage);
    const [error, setError] = useState<string | null>(null);

    const uploadImage = async (file: File) => {
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
    };


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
            uploadImage(e.dataTransfer.files[0]);
        }
    }, []);

    const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            uploadImage(e.target.files[0]);
        }
    };

    const removeImage = () => {
        setPreview(undefined);
        onImageUploaded('');
    };

    return (
        <div className="space-y-2">
            {label && <label className="block text-sm font-medium text-gray-700">{label}</label>}

            {/* Error message */}
            {error && (
                <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                    <FiAlertCircle size={14} className="shrink-0" />
                    <span>{error}</span>
                    <button onClick={() => setError(null)} className="ml-auto"><FiX size={14} /></button>
                </div>
            )}

            {preview ? (
                <div className="relative group">
                    <img
                        src={preview}
                        alt="Preview"
                        className="max-w-xs rounded-lg border-2 border-gray-200"
                    />
                    <button
                        onClick={removeImage}
                        className="absolute top-2 right-2 bg-red-500 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                        <FiX size={16} />
                    </button>
                </div>
            ) : (
                <div
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                    className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${dragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
                        }`}
                >
                    <input
                        type="file"
                        id={`file-upload-${label}`}
                        className="hidden"
                        accept="image/*"
                        onChange={handleFileInput}
                        disabled={uploading}
                    />

                    <label
                        htmlFor={`file-upload-${label}`}
                        className="cursor-pointer flex flex-col items-center space-y-2"
                    >
                        {uploading ? (
                            <>
                                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                                <p className="text-sm text-gray-600">Đang upload...</p>
                            </>
                        ) : (
                            <>
                                <FiImage className="text-gray-400" size={48} />
                                <div className="text-sm text-gray-600">
                                    <span className="font-semibold text-blue-600">Click để chọn ảnh</span> hoặc kéo thả
                                </div>
                                <p className="text-xs text-gray-500">PNG, JPG, GIF, WebP tối đa 5MB</p>
                            </>
                        )}
                    </label>
                </div>
            )}
        </div>
    );
}

