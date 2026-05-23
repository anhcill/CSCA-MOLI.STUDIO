import axios from '../utils/axios';

export interface ExamRegistration {
  id: number;
  exam_id: number;
  user_id: number;
  status: string;
  registered_at: string;
  room_id?: number | null;
  room_name?: string | null;
  location?: string | null;
  seat_number?: number | null;
  exam_title?: string;
  start_time?: string | null;
  end_time?: string | null;
}

export interface ExamRoom {
  id: number;
  exam_id: number;
  room_name: string;
  location?: string | null;
  capacity: number;
  status: string;
  assigned_count?: number;
  proctors?: Array<{
    id: number;
    proctor_id: number;
    role: string;
    full_name?: string | null;
    email?: string | null;
  }>;
}

export interface ExamViolation {
  id: number;
  attempt_id?: number | null;
  exam_id: number;
  user_id: number;
  room_id?: number | null;
  violation_type: string;
  violation_count: number;
  severity: string;
  notes?: string | null;
  created_at: string;
}

export interface ExamCertificate {
  id: number;
  exam_id: number;
  attempt_id: number;
  user_id: number;
  certificate_code: string;
  total_score: number;
  pass_score: number;
  status: string;
  issued_at: string;
  exam_title?: string;
  exam_title_cn?: string | null;
  full_name?: string;
  email?: string;
}

export interface AdmissionTicket {
  registration_id: number;
  status: string;
  registered_at: string;
  approved_at?: string | null;
  exam_id: number;
  exam_code?: string | null;
  exam_title: string;
  exam_title_cn?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  duration?: number | null;
  subject_name?: string | null;
  subject_code?: string | null;
  room_id?: number | null;
  room_name?: string | null;
  location?: string | null;
  seat_number?: number | null;
  user_id: number;
  full_name?: string | null;
  email?: string | null;
  username?: string | null;
  avatar_url?: string | null;
  avatar?: string | null;
  check_in_code: string;
}

export const officialExamApi = {
  getMyRegistration: async (examId: number): Promise<ExamRegistration | null> => {
    const response = await axios.get(`/exams/${examId}/registration`);
    return response.data.data;
  },

  register: async (examId: number): Promise<ExamRegistration> => {
    const response = await axios.post(`/exams/${examId}/register`);
    return response.data.data;
  },

  cancelRegistration: async (examId: number): Promise<ExamRegistration> => {
    const response = await axios.delete(`/exams/${examId}/register`);
    return response.data.data;
  },

  getAdmissionTicket: async (examId: number): Promise<AdmissionTicket> => {
    const response = await axios.get(`/exams/${examId}/admission-ticket`);
    return response.data.data;
  },

  logViolation: async (
    attemptId: number,
    data: { type: string; count?: number; severity?: string; notes?: string; metadata?: Record<string, unknown> },
  ): Promise<ExamViolation> => {
    const response = await axios.post(`/attempts/${attemptId}/violations`, data);
    return response.data.data;
  },

  getMyCertificates: async (): Promise<ExamCertificate[]> => {
    const response = await axios.get('/certificates/me');
    return response.data.data;
  },

  verifyCertificate: async (code: string) => {
    const response = await axios.get(`/certificates/verify/${encodeURIComponent(code)}`);
    return response.data.data;
  },
};

export const officialExamAdminApi = {
  getMonitor: async (examId: number) => {
    const response = await axios.get(`/admin/exams/${examId}/official/monitor`);
    return response.data.data;
  },

  getRegistrations: async (examId: number, status?: string): Promise<ExamRegistration[]> => {
    const response = await axios.get(`/admin/exams/${examId}/registrations`, {
      params: status ? { status } : undefined,
    });
    return response.data.data;
  },

  updateRegistrationStatus: async (
    examId: number,
    registrationId: number,
    data: { status: string; note?: string },
  ): Promise<ExamRegistration> => {
    const response = await axios.put(`/admin/exams/${examId}/registrations/${registrationId}`, data);
    return response.data.data;
  },

  getRooms: async (examId: number): Promise<ExamRoom[]> => {
    const response = await axios.get(`/admin/exams/${examId}/rooms`);
    return response.data.data;
  },

  createRoom: async (
    examId: number,
    data: { room_name: string; location?: string; capacity?: number },
  ): Promise<ExamRoom> => {
    const response = await axios.post(`/admin/exams/${examId}/rooms`, data);
    return response.data.data;
  },

  updateRoom: async (
    examId: number,
    roomId: number,
    data: Partial<{ room_name: string; location: string; capacity: number; status: string }>,
  ): Promise<ExamRoom> => {
    const response = await axios.put(`/admin/exams/${examId}/rooms/${roomId}`, data);
    return response.data.data;
  },

  deleteRoom: async (examId: number, roomId: number) => {
    const response = await axios.delete(`/admin/exams/${examId}/rooms/${roomId}`);
    return response.data;
  },

  autoAssignRooms: async (examId: number): Promise<{ assignedCount: number; remaining: number }> => {
    const response = await axios.post(`/admin/exams/${examId}/rooms/auto-assign`);
    return response.data.data;
  },

  assignStudentToRoom: async (
    examId: number,
    roomId: number,
    data: { registration_id: number; seat_number?: number },
  ) => {
    const response = await axios.post(`/admin/exams/${examId}/rooms/${roomId}/students`, data);
    return response.data.data;
  },

  removeStudentFromRoom: async (examId: number, roomId: number, registrationId: number) => {
    const response = await axios.delete(`/admin/exams/${examId}/rooms/${roomId}/students/${registrationId}`);
    return response.data;
  },

  assignProctor: async (
    examId: number,
    roomId: number,
    data: { proctor_id: number; role?: string },
  ) => {
    const response = await axios.post(`/admin/exams/${examId}/rooms/${roomId}/proctors`, data);
    return response.data.data;
  },

  removeProctor: async (examId: number, roomId: number, assignmentId: number) => {
    const response = await axios.delete(`/admin/exams/${examId}/rooms/${roomId}/proctors/${assignmentId}`);
    return response.data;
  },

  getViolations: async (examId: number): Promise<ExamViolation[]> => {
    const response = await axios.get(`/admin/exams/${examId}/violations`);
    return response.data.data;
  },

  getCertificates: async (examId: number): Promise<ExamCertificate[]> => {
    const response = await axios.get(`/admin/exams/${examId}/certificates`);
    return response.data.data;
  },

  generateCertificates: async (
    examId: number,
    data: { pass_score?: number; attempt_ids?: number[] } = {},
  ): Promise<ExamCertificate[]> => {
    const response = await axios.post(`/admin/exams/${examId}/certificates/generate`, data);
    return response.data.data;
  },
};
