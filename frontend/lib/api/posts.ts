import axiosInstance from '../utils/axios';

export interface Post {
    id: number;
    user_id: number;
    content: string;
    image_url?: string;
    created_at: string;
    updated_at: string;
    author_name: string;
    author_avatar?: string;
    author_email: string;
    like_count: number;
    comment_count: number;
    is_liked: boolean;
}

export interface Comment {
    id: number;
    post_id: number;
    user_id: number;
    content: string;
    created_at: string;
    author_name: string;
    author_avatar?: string;
}

export interface CreatePostData {
    content: string;
    image_url?: string;
}

export interface CreateCommentData {
    content: string;
}

// Get all posts (feed)
export const getPosts = async (limit: number = 20, offset: number = 0): Promise<Post[]> => {
    const response = await axiosInstance.get(`/posts?limit=${limit}&offset=${offset}`);
    return response.data.data;
};

// Create new post
export const createPost = async (data: CreatePostData): Promise<Post> => {
    const response = await axiosInstance.post('/posts', data);
    return response.data.data;
};

// Update post
export const updatePost = async (postId: number, data: CreatePostData): Promise<Post> => {
    const response = await axiosInstance.put(`/posts/${postId}`, data);
    return response.data.data;
};

// Delete post
export const deletePost = async (postId: number): Promise<void> => {
    await axiosInstance.delete(`/posts/${postId}`);
};

// Like post
export const likePost = async (postId: number): Promise<{ like_count: number }> => {
    const response = await axiosInstance.post(`/posts/${postId}/like`);
    return response.data.data;
};

// Unlike post
export const unlikePost = async (postId: number): Promise<{ like_count: number }> => {
    const response = await axiosInstance.delete(`/posts/${postId}/like`);
    return response.data.data;
};

// Get comments for post
export const getComments = async (postId: number): Promise<Comment[]> => {
    const response = await axiosInstance.get(`/posts/${postId}/comments`);
    return response.data.data;
};

// Add comment to post
export const addComment = async (postId: number, data: CreateCommentData): Promise<Comment> => {
    const response = await axiosInstance.post(`/posts/${postId}/comments`, data);
    return response.data.data.comment;
};
