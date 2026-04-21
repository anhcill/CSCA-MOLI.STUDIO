import axios from 'axios';

const api = axios.create({
    baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api',
    withCredentials: true
});

export interface Ticket {
    id: number;
    user_id: number;
    category: string;
    reference_url: string;
    content: string;
    image_url: string | null;
    status: 'pending' | 'answered' | 'closed';
    created_at: string;
    updated_at: string;
    reply_count?: number;
    author_name?: string;
    author_avatar?: string;
    author_email?: string;
    replies?: TicketReply[];
}

export interface TicketReply {
    id: number;
    ticket_id: number;
    sender_id: number;
    is_admin_reply: boolean;
    content: string;
    image_url: string | null;
    created_at: string;
    sender_name?: string;
    sender_avatar?: string;
}

export const qaApi = {
    // --- USER APIs ---
    createTicket: async (data: { category: string; referenceUrl?: string; content: string; imageUrl?: string }) => {
        const res = await api.post('/qa/create', data);
        return res.data;
    },

    getMyTickets: async () => {
        const res = await api.get('/qa/my-tickets');
        return res.data.data as Ticket[];
    },

    getTicketDetail: async (id: number) => {
        const res = await api.get(`/qa/${id}`);
        return res.data.data as Ticket;
    },

    replyToTicket: async (id: number, data: { content: string; imageUrl?: string }) => {
        const res = await api.post(`/qa/${id}/reply`, data);
        return res.data;
    },

    // --- ADMIN APIs ---
    adminGetAllTickets: async (statusFilter?: string) => {
        const res = await api.get('/admin/qa/tickets', { params: { status: statusFilter } });
        return res.data.data as Ticket[];
    },

    adminGetTicketDetail: async (id: number) => {
        const res = await api.get(`/admin/qa/tickets/${id}`);
        return res.data.data as Ticket;
    },

    adminReplyTicket: async (id: number, data: { content: string; imageUrl?: string }) => {
        const res = await api.post(`/admin/qa/tickets/${id}/reply`, data);
        return res.data;
    },

    adminChangeStatus: async (id: number, status: string) => {
        const res = await api.put(`/admin/qa/tickets/${id}/status`, { status });
        return res.data;
    },

    // --- UPLOAD ---
    uploadImage: async (file: File) => {
        const formData = new FormData();
        formData.append('image', file);
        // Using the general upload endpoint which requires user authentication but not admin
        const res = await api.post('/upload/question-image', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        return res.data;
    }
};
