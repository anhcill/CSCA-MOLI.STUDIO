const { v2: cloudinary } = require("cloudinary");

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Helper: Upload buffer to Cloudinary
function uploadToCloudinary(buffer, folder = "csca/questions") {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: "image" },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      },
    );
    stream.end(buffer);
  });
}

const uploadController = {
  // Upload ảnh cho câu hỏi
  async uploadQuestionImage(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "Không có file được upload",
        });
      }

      // Upload lên Cloudinary
      const result = await uploadToCloudinary(
        req.file.buffer,
        "csca/questions",
      );

      res.json({
        success: true,
        message: "Upload ảnh thành công",
        data: {
          url: result.secure_url,
          publicId: result.public_id,
          size: req.file.size,
          mimetype: req.file.mimetype,
        },
      });
    } catch (error) {
      console.error("Upload image error:", error);
      res.status(500).json({
        success: false,
        message: "Lỗi khi upload ảnh",
        error: error.message,
      });
    }
  },

  // Upload nhiều ảnh cùng lúc
  async uploadMultipleImages(req, res) {
    try {
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Không có file được upload",
        });
      }

      // Upload tất cả ảnh lên Cloudinary
      const uploadPromises = req.files.map((file) =>
        uploadToCloudinary(file.buffer, "csca/questions"),
      );
      const results = await Promise.all(uploadPromises);

      const images = results.map((result, index) => ({
        url: result.secure_url,
        publicId: result.public_id,
        size: req.files[index].size,
        mimetype: req.files[index].mimetype,
      }));

      res.json({
        success: true,
        message: `Upload ${images.length} ảnh thành công`,
        data: images,
      });
    } catch (error) {
      console.error("Upload multiple images error:", error);
      res.status(500).json({
        success: false,
        message: "Lỗi khi upload ảnh",
        error: error.message,
      });
    }
  },

  // Xóa ảnh từ Cloudinary
  async deleteImage(req, res) {
    try {
      const { publicId } = req.params;

      if (!publicId) {
        return res.status(400).json({
          success: false,
          message: "Không có publicId",
        });
      }

      // Xóa từ Cloudinary
      await cloudinary.uploader.destroy(publicId);

      res.json({
        success: true,
        message: "Xóa ảnh thành công",
      });
    } catch (error) {
      console.error("Delete image error:", error);
      res.status(500).json({
        success: false,
        message: "Lỗi khi xóa ảnh",
        error: error.message,
      });
    }
  },
};

module.exports = uploadController;

module.exports = uploadController;
