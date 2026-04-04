/**
 * Cloudinary Image Optimization Helper
 * Tối ưu URL ảnh từ Cloudinary với transformations
 */

interface CloudinaryOptions {
  width?: number;
  height?: number;
  quality?: 'auto' | number;
  format?: 'auto' | 'webp' | 'avif' | 'jpg' | 'png';
  crop?: 'fill' | 'fit' | 'scale' | 'thumb';
  gravity?: 'auto' | 'face' | 'center';
}

/**
 * Optimize Cloudinary image URL
 * @param url - Original Cloudinary URL
 * @param options - Transformation options
 * @returns Optimized URL string
 */
export function optimizeCloudinaryImage(
  url: string,
  options: CloudinaryOptions = {}
): string {
  // Check if it's a Cloudinary URL
  if (!url || !url.includes('res.cloudinary.com')) {
    return url;
  }

  const {
    width,
    height,
    quality = 'auto',
    format = 'auto',
    crop = 'fill',
    gravity = 'auto',
  } = options;

  // Build transformation string
  const transformations: string[] = [];

  if (width) transformations.push(`w_${width}`);
  if (height) transformations.push(`h_${height}`);
  if (crop) transformations.push(`c_${crop}`);
  if (gravity && crop === 'fill') transformations.push(`g_${gravity}`);
  transformations.push(`q_${quality}`);
  transformations.push(`f_${format}`);

  const transformStr = transformations.join(',');

  // Insert transformations into URL
  // URL format: https://res.cloudinary.com/{cloud_name}/{resource_type}/upload/...
  const parts = url.split('/upload/');
  if (parts.length === 2) {
    return `${parts[0]}/upload/${transformStr}/${parts[1]}`;
  }

  return url;
}

/**
 * Preset transformations
 */
export const imagePresets = {
  thumbnail: (url: string) =>
    optimizeCloudinaryImage(url, {
      width: 150,
      height: 150,
      crop: 'thumb',
      quality: 'auto',
    }),

  avatar: (url: string) =>
    optimizeCloudinaryImage(url, {
      width: 200,
      height: 200,
      crop: 'fill',
      gravity: 'face',
      quality: 'auto',
    }),

  postImage: (url: string) =>
    optimizeCloudinaryImage(url, {
      width: 800,
      quality: 'auto',
      format: 'webp',
    }),

  questionImage: (url: string) =>
    optimizeCloudinaryImage(url, {
      width: 1200,
      quality: 85,
      format: 'auto',
    }),
};

/**
 * Get responsive srcSet for Cloudinary images
 */
export function getResponsiveSrcSet(url: string): string {
  if (!url || !url.includes('res.cloudinary.com')) {
    return url;
  }

  const sizes = [640, 750, 828, 1080, 1200, 1920];
  return sizes
    .map((size) => {
      const optimized = optimizeCloudinaryImage(url, {
        width: size,
        quality: 'auto',
        format: 'auto',
      });
      return `${optimized} ${size}w`;
    })
    .join(', ');
}
