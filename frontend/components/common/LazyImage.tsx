'use client';

import Image from 'next/image';
import { useState } from 'react';
import { optimizeCloudinaryImage } from '@/lib/utils/imageOptimizer';

interface LazyImageProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
  priority?: boolean;
  quality?: number;
  fill?: boolean;
}

/**
 * Optimized Image Component với lazy loading & Cloudinary optimization
 */
export default function LazyImage({
  src,
  alt,
  width,
  height,
  className = '',
  priority = false,
  quality = 80,
  fill = false,
}: LazyImageProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);

  // Optimize Cloudinary URLs
  const optimizedSrc = src.includes('res.cloudinary.com')
    ? optimizeCloudinaryImage(src, { quality: 'auto', format: 'auto' })
    : src;

  if (error) {
    return (
      <div
        className={`bg-gray-100 flex items-center justify-center ${className}`}
        style={{ width, height }}
      >
        <span className="text-gray-400 text-xs">Ảnh lỗi</span>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      {fill ? (
        <Image
          src={optimizedSrc}
          alt={alt}
          fill
          quality={quality}
          priority={priority}
          className={`object-cover transition-opacity duration-300 ${
            isLoading ? 'opacity-0' : 'opacity-100'
          }`}
          onLoadingComplete={() => setIsLoading(false)}
          onError={() => setError(true)}
        />
      ) : (
        <Image
          src={optimizedSrc}
          alt={alt}
          width={width}
          height={height}
          quality={quality}
          priority={priority}
          className={`transition-opacity duration-300 ${
            isLoading ? 'opacity-0' : 'opacity-100'
          }`}
          onLoadingComplete={() => setIsLoading(false)}
          onError={() => setError(true)}
        />
      )}

      {isLoading && (
        <div
          className="absolute inset-0 bg-gray-100 animate-pulse"
          style={{ width, height }}
        />
      )}
    </div>
  );
}
