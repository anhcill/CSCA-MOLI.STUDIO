import axios from '../utils/axios';

export const imageApi = {
    // Upload multiple images
    async uploadImages(files: File[]) {
        const formData = new FormData();
        files.forEach(file => {
            formData.append('images', file);
        });

        const response = await axios.post('/admin/images/upload-multiple', formData, {
            headers: {
                'Content-Type': 'multipart/form-data'
            }
        });
        return response.data;
    },

    // Get all uploaded images
    async getImages() {
        const response = await axios.get('/admin/images/list');
        return response.data;
    },

    // Delete image
    async deleteImage(publicId: string) {
        const response = await axios.delete('/admin/images/delete', {
            data: { publicId }
        });
        return response.data;
    }
};
