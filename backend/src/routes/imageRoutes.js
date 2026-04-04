const express = require('express');
const router = express.Router();
const multer = require('multer');
const { v2: cloudinary } = require('cloudinary');
const { authenticate, authorize } = require('../middleware/authMiddleware');

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Use memory storage — file goes to Cloudinary, not disk
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    fileFilter: (req, file, cb) => {
        const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
        if (allowed.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Chỉ chấp nhận file ảnh (jpg, png, gif, webp)'));
        }
    },
});

// Helper: upload buffer to Cloudinary
function uploadToCloudinary(buffer, folder = 'csca/questions') {
    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            {
                folder,
                resource_type: 'image',
                transformation: [{ quality: 'auto', fetch_format: 'auto' }],
            },
            (error, result) => {
                if (error) reject(error);
                else resolve(result);
            }
        );
        stream.end(buffer);
    });
}

// All image routes require admin
router.use(authenticate, authorize(['admin']));

// ── Single image upload ──────────────────────────────────────────────────────
// POST /api/admin/images/upload  (field: 'image')
router.post('/upload', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'Không có file được upload' });
        }

        const result = await uploadToCloudinary(req.file.buffer);

        return res.json({
            success: true,
            message: 'Upload ảnh thành công',
            data: {
                url: result.secure_url,          // HTTPS URL from Cloudinary CDN
                publicId: result.public_id,
                width: result.width,
                height: result.height,
                format: result.format,
                size: result.bytes,
            },
        });
    } catch (error) {
        console.error('Single upload error:', error);
        return res.status(500).json({ success: false, message: 'Lỗi khi upload ảnh', error: error.message });
    }
});

// ── Multiple images upload ────────────────────────────────────────────────────
// POST /api/admin/images/upload-multiple  (field: 'images', max 20)
router.post('/upload-multiple', upload.array('images', 20), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ success: false, message: 'Không có file được upload' });
        }

        const results = await Promise.all(
            req.files.map(file => uploadToCloudinary(file.buffer))
        );

        const uploadedImages = results.map(r => ({
            url: r.secure_url,
            publicId: r.public_id,
            width: r.width,
            height: r.height,
        }));

        return res.json({
            success: true,
            message: `${uploadedImages.length} ảnh đã upload thành công`,
            data: uploadedImages,
        });
    } catch (error) {
        console.error('Multiple upload error:', error);
        return res.status(500).json({ success: false, message: 'Lỗi khi upload ảnh', error: error.message });
    }
});

// ── Delete image from Cloudinary ─────────────────────────────────────────────
// DELETE /api/admin/images/:publicId  (publicId encoded as base64 or passed in body)
router.delete('/delete', async (req, res) => {
    try {
        const { publicId } = req.body;
        if (!publicId) {
            return res.status(400).json({ success: false, message: 'Thiếu publicId' });
        }

        await cloudinary.uploader.destroy(publicId);
        return res.json({ success: true, message: 'Đã xóa ảnh' });
    } catch (error) {
        console.error('Delete image error:', error);
        return res.status(500).json({ success: false, message: 'Lỗi khi xóa ảnh', error: error.message });
    }
});

// ── List images in Cloudinary folder ─────────────────────────────────────────
router.get('/list', async (req, res) => {
    try {
        const result = await cloudinary.api.resources({
            type: 'upload',
            prefix: 'csca/questions',
            max_results: 100,
        });

        const images = result.resources.map(r => ({
            url: r.secure_url,
            publicId: r.public_id,
            width: r.width,
            height: r.height,
            size: r.bytes,
            createdAt: r.created_at,
        }));

        return res.json({ success: true, data: images });
    } catch (error) {
        console.error('List images error:', error);
        return res.status(500).json({ success: false, message: 'Lỗi khi lấy danh sách ảnh', error: error.message });
    }
});

module.exports = router;
