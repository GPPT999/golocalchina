import axios from 'axios';

// In production (Vercel), API calls go through the rewrite rule in vercel.json
// In development, they proxy through vite.config.ts
const api = axios.create({
  baseURL: '/api/v1',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('glc_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export interface Guide {
  user_id: string;
  display_name: string;
  languages: string[];
  service_cities: string[];
  specialties: string[];
  rating_avg: number;
  rating_count: number;
  default_rate_cny: number;
  avatar_url: string | null;
  bio: string | null;
}

export interface GuideDetail extends Guide {
  guide_license_no: string;
  guide_license_issuer: string;
  kyc_status: string;
  accepts_cash: boolean;
  alipay_qr_url: string | null;
  wechat_pay_qr_url: string | null;
  payment_note: string | null;
  listings: Array<{
    id: string;
    title: string;
    summary: string;
    city: string;
    price_amount: number;
    price_currency: string;
    price_unit: string;
  }>;
}

export interface SearchParams {
  city?: string;
  language?: string;
  specialty?: string;
  min_rating?: number;
  max_price_cny?: number;
  page?: number;
  per_page?: number;
}

export interface SearchResponse {
  guides: Guide[];
  total: number;
  page: number;
  per_page: number;
}

export const guideApi = {
  search: (params: SearchParams) =>
    api.get<SearchResponse>('/guides', { params }).then(r => r.data),
  getDetail: (id: string) =>
    api.get<GuideDetail>(`/guides/${id}`).then(r => r.data),
};

export const authApi = {
  register: (data: { email: string; password: string; role: string; display_name: string }) =>
    api.post('/auth/register', data).then(r => r.data),
  login: (data: { email: string; password: string }) =>
    api.post('/auth/login', data).then(r => r.data),
};

export const serviceRequestApi = {
  create: (data: {
    guide_user_id: string;
    listing_id?: string | null;
    service_date: string;
    service_time_hour?: number | null;
    party_size: number;
    language: string;
    tourist_notes?: string;
    quoted_amount?: number;
    quoted_currency?: string;
  }) =>
    api.post('/service-requests', data).then(r => r.data),
  listMine: () =>
    api.get('/service-requests/mine').then(r => r.data),
};

export default api;
