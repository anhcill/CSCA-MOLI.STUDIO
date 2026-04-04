import axios from '../utils/axios';

export interface User {
  id: number;
  username: string;
  email: string;
  full_name: string;
  display_name: string;
  avatar: string;
  role: string;
  bio?: string;
  target_score?: number;
  created_at: string;
}

export interface UpdateProfileData {
  full_name?: string;
  display_name?: string;
  bio?: string;
  target_score?: number;
}

export interface UserStats {
  total_exams: number;
  avg_score: number;
  highest_score: number;
  total_posts: number;
  total_comments: number;
}

export const getUserById = async (id: number): Promise<{ success: boolean; data: { user: User } }> => {
  const response = await axios.get(`/users/${id}`);
  return response.data;
};

export const updateProfile = async (id: number, data: UpdateProfileData): Promise<{ success: boolean; message: string; data: { user: User } }> => {
  const response = await axios.put(`/users/${id}`, data);
  return response.data;
};

export const updateAvatar = async (id: number, avatar: string): Promise<{ success: boolean; message: string; data: { user: User } }> => {
  const response = await axios.post(`/users/${id}/avatar`, { avatar });
  return response.data;
};

export const getUserStats = async (id: number): Promise<{ success: boolean; data: UserStats }> => {
  const response = await axios.get(`/users/${id}/stats`);
  return response.data;
};

export const changePassword = async (id: number, currentPassword: string, newPassword: string): Promise<{ success: boolean; message: string }> => {
  const response = await axios.post(`/users/${id}/change-password`, { currentPassword, newPassword });
  return response.data;
};

