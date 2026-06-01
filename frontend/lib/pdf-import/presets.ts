export type PdfImportPreset =
    | 'auto'
    | 'math'
    | 'science'
    | 'language'
    | 'humanities'
    | 'image_heavy';

export interface PdfImportPresetOption {
    key: PdfImportPreset;
    label: string;
    description: string;
}

export const PDF_IMPORT_PRESETS: PdfImportPresetOption[] = [
    {
        key: 'auto',
        label: 'Tự nhận diện',
        description: 'Dùng cho đề tổng hợp hoặc chưa rõ môn.',
    },
    {
        key: 'math',
        label: 'Toán',
        description: 'Ưu tiên phân số, mũ, căn, phương trình, lời giải.',
    },
    {
        key: 'science',
        label: 'Lý/Hóa/Sinh',
        description: 'Ưu tiên công thức, đơn vị, thí nghiệm, biểu đồ.',
    },
    {
        key: 'language',
        label: 'Ngôn ngữ',
        description: 'Ưu tiên đọc hiểu, từ vựng, song ngữ, giải thích.',
    },
    {
        key: 'humanities',
        label: 'Xã hội',
        description: 'Ưu tiên đoạn dài, mốc thời gian, địa danh, nguồn trích.',
    },
    {
        key: 'image_heavy',
        label: 'Nhiều hình',
        description: 'Đánh dấu câu cần ảnh/bảng/biểu đồ để review.',
    },
];
