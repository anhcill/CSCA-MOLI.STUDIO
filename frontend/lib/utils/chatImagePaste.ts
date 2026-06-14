export interface PastedChatImage {
  dataUrl: string;
  name: string;
  size: number;
}

const MAX_SOURCE_IMAGE_SIZE = 8 * 1024 * 1024;
const MAX_DATA_URL_LENGTH = 1_500_000;
const MAX_IMAGE_SIDE = 1280;

export function getClipboardImageFile(clipboardData: DataTransfer) {
  const item = Array.from(clipboardData.items || []).find(
    entry => entry.kind === 'file' && entry.type.startsWith('image/'),
  );
  const itemFile = item?.getAsFile();
  if (itemFile) return itemFile;
  return Array.from(clipboardData.files || []).find(file => file.type.startsWith('image/')) || null;
}

function readImage(imageUrl: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Khong doc duoc anh.'));
    image.src = imageUrl;
  });
}

export async function preparePastedChatImage(file: File): Promise<PastedChatImage> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Chi chap nhan file anh.');
  }
  if (file.size > MAX_SOURCE_IMAGE_SIZE) {
    throw new Error('Anh qua lon. Toi da 8MB.');
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await readImage(objectUrl);
    const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(image.naturalWidth, image.naturalHeight));
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Khong the nen anh.');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(image, 0, 0, width, height);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
    if (dataUrl.length > MAX_DATA_URL_LENGTH) {
      throw new Error('Anh sau khi nen van qua lon. Hay cat nho anh roi gui lai.');
    }

    return {
      dataUrl,
      name: file.name || 'clipboard-image.jpg',
      size: file.size,
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
