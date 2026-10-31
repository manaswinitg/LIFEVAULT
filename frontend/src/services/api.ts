import axios from 'axios';
import {
  User,
  DocumentItem,
  DocumentCategory,
  DocumentTag,
  DocumentVersion,
  DashboardSummary,
  ShareGrant,
  NotificationItem,
  TrustedContact,
  EmergencyAccessPolicy,
  EmergencyAccessRequest,
  AuditEventItem,
} from '../types';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('lifevault_token');
  if (token && config.headers) {
    config.headers.Authorization = `Token ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && !window.location.pathname.includes('/login')) {
      localStorage.removeItem('lifevault_token');
      localStorage.removeItem('lifevault_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const DashboardService = {
  getSummary: async (): Promise<DashboardSummary> => {
    const res = await api.get('/dashboard/summary/');
    return res.data;
  },
};

export const DocumentService = {
  list: async (params?: { category?: string; q?: string; archived?: boolean; ordering?: string }): Promise<DocumentItem[]> => {
    const res = await api.get('/documents/', { params });
    return res.data;
  },
  getCategories: async (): Promise<DocumentCategory[]> => {
    const res = await api.get('/documents/categories/');
    return res.data;
  },
  getTags: async (): Promise<DocumentTag[]> => {
    const res = await api.get('/documents/tags/');
    return res.data;
  },
  getDetail: async (id: string): Promise<DocumentItem> => {
    const res = await api.get(`/documents/${id}/`);
    return res.data;
  },
  upload: async (formData: FormData, onProgress?: (percent: number) => void): Promise<DocumentItem> => {
    const res = await api.post('/documents/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (progressEvent) => {
        if (progressEvent.total && onProgress) {
          onProgress(Math.round((progressEvent.loaded * 100) / progressEvent.total));
        }
      },
    });
    return res.data;
  },
  update: async (id: string, data: Partial<DocumentItem> & { category_id?: string; tag_names?: string[] }): Promise<DocumentItem> => {
    const res = await api.patch(`/documents/${id}/`, data);
    return res.data;
  },
  delete: async (id: string): Promise<void> => {
    await api.delete(`/documents/${id}/`);
  },
  download: async (id: string, filename: string): Promise<void> => {
    const res = await api.get(`/documents/${id}/download/`, { responseType: 'blob' });
    const url = window.URL.createObjectURL(new Blob([res.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
  },
  toggleArchive: async (id: string): Promise<{ is_archived: boolean }> => {
    const res = await api.post(`/documents/${id}/archive/`);
    return res.data;
  },
  getTrash: async (): Promise<DocumentItem[]> => {
    const res = await api.get('/documents/trash/');
    return res.data;
  },
  restoreTrash: async (id: string): Promise<void> => {
    await api.post(`/documents/${id}/restore/`);
  },
  permanentDelete: async (id: string): Promise<void> => {
    await api.delete(`/documents/${id}/permanent/`);
  },
  uploadVersion: async (id: string, formData: FormData): Promise<DocumentVersion> => {
    const res = await api.post(`/documents/${id}/versions/`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },
  downloadVersion: async (docId: string, versionNumber: number, filename: string): Promise<void> => {
    const res = await api.get(`/documents/${docId}/versions/${versionNumber}/download/`, { responseType: 'blob' });
    const url = window.URL.createObjectURL(new Blob([res.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
  },
  restoreVersion: async (docId: string, versionNumber: number): Promise<void> => {
    await api.post(`/documents/${docId}/versions/${versionNumber}/restore/`);
  },
};

export const SharingService = {
  getGrants: async (): Promise<ShareGrant[]> => {
    const res = await api.get('/sharing/grants/');
    return res.data;
  },
  createGrant: async (data: {
    document_id: string;
    share_type: 'user' | 'link';
    shared_with_email?: string;
    permission: 'view' | 'download';
    expires_at?: string | null;
    max_downloads?: number | null;
  }): Promise<ShareGrant> => {
    const res = await api.post('/sharing/grants/', data);
    return res.data;
  },
  revokeGrant: async (id: string): Promise<void> => {
    await api.post(`/sharing/grants/${id}/revoke/`);
  },
  getSharedWithMe: async (): Promise<ShareGrant[]> => {
    const res = await api.get('/sharing/shared-with-me/');
    return res.data;
  },
  getPublicMetadata: async (token: string): Promise<any> => {
    const res = await api.get(`/sharing/public/${token}/`);
    return res.data;
  },
  downloadPublicFile: async (token: string, filename: string): Promise<void> => {
    const res = await api.get(`/sharing/public/${token}/download/`, { responseType: 'blob' });
    const url = window.URL.createObjectURL(new Blob([res.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
  },
};

export const ReminderService = {
  getUpcoming: async (): Promise<DocumentItem[]> => {
    const res = await api.get('/reminders/upcoming/');
    return res.data;
  },
  createReminder: async (data: { document_id: string; reminder_days_before: number }) => {
    const res = await api.post('/reminders/', data);
    return res.data;
  },
  getNotifications: async (): Promise<{ unread_count: number; results: NotificationItem[] }> => {
    const res = await api.get('/reminders/notifications/');
    return res.data;
  },
  markRead: async (id: string): Promise<void> => {
    await api.post(`/reminders/notifications/${id}/read/`);
  },
  markAllRead: async (): Promise<void> => {
    await api.post('/reminders/notifications/read-all/');
  },
};

export const EmergencyService = {
  getContacts: async (): Promise<TrustedContact[]> => {
    const res = await api.get('/emergency/contacts/');
    return res.data;
  },
  addContact: async (data: Partial<TrustedContact>): Promise<TrustedContact> => {
    const res = await api.post('/emergency/contacts/', data);
    return res.data;
  },
  deleteContact: async (id: string): Promise<void> => {
    await api.delete(`/emergency/contacts/${id}/`);
  },
  getPolicies: async (): Promise<EmergencyAccessPolicy[]> => {
    const res = await api.get('/emergency/policies/');
    return res.data;
  },
  createPolicy: async (data: {
    trusted_contact_id: string;
    waiting_period_hours: number;
    can_access_all: boolean;
    document_ids?: string[];
  }): Promise<EmergencyAccessPolicy> => {
    const res = await api.post('/emergency/policies/', data);
    return res.data;
  },
  cancelRequest: async (id: string): Promise<void> => {
    await api.post(`/emergency/requests/${id}/cancel/`);
  },
  approveRequest: async (id: string): Promise<void> => {
    await api.post(`/emergency/requests/${id}/approve/`);
  },
};

export const AuditService = {
  getEvents: async (): Promise<AuditEventItem[]> => {
    const res = await api.get('/audit/');
    return res.data;
  },
  verifyChain: async (): Promise<{ is_valid: boolean; total_events: number; message: string; broken_event_id: string | null }> => {
    const res = await api.get('/audit/verify/');
    return res.data;
  },
};

export default api;
