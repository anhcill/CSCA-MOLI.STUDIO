const { v2: cloudinary } = require("cloudinary");

/**
 * Cloudinary — configured once at startup, shared across all routes.
 * C2 fix: centralize config instead of duplicating in users.js and posts.js.
 */
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Upload a buffer to Cloudinary.
 * @param {Buffer} buffer - File buffer from multer memoryStorage
 * @param {object} options - Cloudinary upload options (folder, resource_type, etc.)
 * @returns {Promise<object>} Cloudinary upload result
 */
function uploadStream(buffer, options = {}) {
    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(options, (err, result) =>
            err ? reject(err) : resolve(result),
        );
        stream.end(buffer);
    });
}

module.exports = { cloudinary, uploadStream };
