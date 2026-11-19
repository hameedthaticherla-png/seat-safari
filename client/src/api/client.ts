import { Space, Hold, AuditLog, SystemSettings, User, Building, Seat, SeatReservation } from '../types';

const API_BASE = '/api';
const OCCUPANCY_DEVICE_KEY = 'safari_occupancy_device';

function getOccupancyDeviceToken() {
  let token = localStorage.getItem(OCCUPANCY_DEVICE_KEY);
  if (!token) {
    token = typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(OCCUPANCY_DEVICE_KEY, token);
  }
  return token;
}

class ApiError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('safari_token');
  const headers = new Headers(options.headers || {});
  
  headers.set('Content-Type', 'application/json');
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    // If token invalid, clear it
    if (response.status === 401 && token) {
      localStorage.removeItem('safari_token');
      localStorage.removeItem('safari_user');
      window.dispatchEvent(new Event('safari_auth_change'));
    }
    throw new ApiError(data.error || 'Request failed', response.status, data.code);
  }

  return data as T;
}

export const api = {
  occupancy: {
    getDeviceToken: getOccupancyDeviceToken,
    getLocations: () =>
      request<{ buildings: Array<{ id: string; name: string; campus: string; hours: string; floors: Array<{
        id: string; building_id: string; floor_number: number; name: string; description?: string;
        spaces: Array<{ id: string; name: string; description?: string; hours: string; facilities: string[];
          total_seats: number; occupied_seats: number; seats: Seat[] }>;
      }> }> }>('/occupancy/locations', { headers: { 'X-Occupancy-Device': getOccupancyDeviceToken() } }),
    getCentralLibrary: () =>
      request<{ building: { id: string; name: string }; floors: Array<{
        id: string; floor_number: number; name: string; description?: string;
        spaces: Array<{ id: string; name: string; description?: string; facilities: string[];
          total_seats: number; occupied_seats: number; seats: Seat[] }>;
      }> }>('/occupancy/central-library'),
    setSeatOccupied: (seatId: string, occupied: boolean) =>
      request<{ seat_id: string; occupied: boolean }>(`/occupancy/seats/${encodeURIComponent(seatId)}`, {
        method: 'POST',
        body: JSON.stringify({ occupied, device_token: getOccupancyDeviceToken() }),
      }),
    submitFeedback: (payload: { category: 'suggestion' | 'complaint' | 'issue' | 'feedback'; message: string; seat_id?: string }) =>
      request<{ id: string; message: string }>('/occupancy/feedback', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
  },

  // Auth
  auth: {
    login: (credentials: { email: string; password: string }) =>
      request<{ token: string; user: User }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify(credentials),
      }),
    me: () => request<{ user: User }>('/auth/me'),
    getDemoAccounts: () => request<{ accounts: any[] }>('/auth/demo-accounts'),
  },

  // Spaces
  spaces: {
    find: (params: { activity?: string; needs?: string[]; time?: string; day_type?: string } = {}) => {
      const q = new URLSearchParams();
      if (params.activity) q.set('activity', params.activity);
      if (params.needs && params.needs.length > 0) q.set('needs', params.needs.join(','));
      if (params.time) q.set('time', params.time);
      if (params.day_type) q.set('day_type', params.day_type);
      return request<{ spaces: Space[]; query: any }>(`/spaces?${q.toString()}`);
    },
    getById: (id: string) => request<{ space: Space }>(`/spaces/${id}`),
    getPlanB: (id: string) =>
      request<{ current_space_name: string; current_zone_type: string; plan_b_recommendations: Space[] }>(
        `/spaces/${id}/plan-b`
      ),
  },

  // Reports
  reports: {
    submit: (spaceId: string, status: 'Free' | 'Filling up' | 'Full') =>
      request<{ message: string; report: any }>(`/reports/${spaceId}`, {
        method: 'POST',
        body: JSON.stringify({ status }),
      }),
    flagFeedback: (reportId: string) =>
      request<{ message: string; retired: boolean }>(`/reports/${reportId}/flag`, {
        method: 'POST',
      }),
    submitProblem: (spaceId: string, category: string, note: string) =>
      request<{ message: string }>(`/reports/${spaceId}/problem`, {
        method: 'POST',
        body: JSON.stringify({ category, note }),
      }),
  },

  // Holds
  holds: {
    getMyActive: () => request<{ hold: Hold | null; message?: string }>('/holds/my-active'),
    request: (roomId: string, durationMinutes = 120) =>
      request<{ message: string; hold: Hold }>(`/holds/${roomId}`, {
        method: 'POST',
        body: JSON.stringify({ durationMinutes }),
      }),
    checkIn: (holdId: string) =>
      request<{ message: string; hold_id: string; status: string }>(`/holds/${holdId}/check-in`, {
        method: 'POST',
      }),
    release: (holdId: string) =>
      request<{ message: string; hold_id: string; status: string }>(`/holds/${holdId}/release`, {
        method: 'POST',
      }),
  },

  // Favourites
  favourites: {
    list: () => request<{ favourites: Space[] }>('/favourites'),
    add: (spaceId: string) =>
      request<{ message: string; is_favourite: boolean }>(`/favourites/${spaceId}`, {
        method: 'POST',
      }),
    remove: (spaceId: string) =>
      request<{ message: string; is_favourite: boolean }>(`/favourites/${spaceId}`, {
        method: 'DELETE',
      }),
  },

  // Interactive Reservations (BookMyShow-style)
  reservations: {
    getHierarchy: () =>
      request<{ campus: string; buildings: Building[] }>('/reservations/hierarchy'),
    getLayout: (spaceId: string) =>
      request<{
        space: Space;
        layout_type: string;
        front_label: string;
        tables: any[];
        seats: Seat[];
      }>(`/reservations/spaces/${spaceId}/layout`),
    getAvailability: (spaceId: string, params: { date: string; start_time: string; end_time: string }) => {
      const q = new URLSearchParams({
        date: params.date,
        start_time: params.start_time,
        end_time: params.end_time,
      });
      return request<{
        space_id: string;
        date: string;
        start_time: string;
        end_time: string;
        hold_timeout_minutes: number;
        seats: Seat[];
      }>(`/reservations/spaces/${spaceId}/availability?${q.toString()}`);
    },
    holdSeat: (payload: { seat_id: string; space_id: string; date: string; start_time: string; end_time: string }) =>
      request<{
        message: string;
        reservation: {
          id: string;
          booking_reference: string;
          seat_id: string;
          held_until: string;
          expires_in_seconds: number;
        };
      }>('/reservations/hold', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    releaseHold: (payload: { reservation_id?: string; seat_id?: string; date?: string; start_time?: string; end_time?: string }) =>
      request<{ message: string; released: boolean }>('/reservations/release-hold', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    book: (payload: {
      reservation_id?: string;
      seat_id?: string;
      space_id?: string;
      date?: string;
      start_time?: string;
      end_time?: string;
      notes?: string;
    }) =>
      request<{ message: string; reservation: SeatReservation }>('/reservations/book', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    getMyReservations: () =>
      request<{ reservations: SeatReservation[] }>('/reservations/my'),
    getDetails: (id: string) =>
      request<{ reservation: SeatReservation }>(`/reservations/${id}`),
    checkIn: (id: string) =>
      request<{ message: string; reservation: SeatReservation }>(`/reservations/${id}/check-in`, {
        method: 'POST',
      }),
    cancel: (id: string, reason?: string) =>
      request<{ message: string; cancelled: boolean }>(`/reservations/${id}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      }),
    verifyTicket: (qrToken: string) =>
      request<{ valid: boolean; reservation: SeatReservation }>(`/reservations/verify/${qrToken}`),
  },

  // Staff Console
  staff: {
    getDashboard: () =>
      request<{
        metrics: {
          total_spaces: number;
          stale_spaces_count: number;
          active_reports_count: number;
          active_holds_count: number;
          pending_problems_count: number;
        };
        stale_spaces: any[];
        recent_reports: any[];
        active_holds: any[];
        pending_problems: any[];
        user_scope: string;
      }>('/staff/dashboard'),
    getSpaces: () => request<{ spaces: Space[] }>('/staff/spaces'),
    createSpace: (spaceData: any) =>
      request<{ message: string; id: string }>('/staff/spaces', {
        method: 'POST',
        body: JSON.stringify(spaceData),
      }),
    updateSpace: (id: string, spaceData: any) =>
      request<{ message: string }>(`/staff/spaces/${id}`, {
        method: 'PUT',
        body: JSON.stringify(spaceData),
      }),
    confirmAccurate: (id: string) =>
      request<{ message: string; last_checked_at: string }>(`/staff/spaces/${id}/confirm`, {
        method: 'POST',
      }),
    bulkConfirm: (space_ids: string[]) =>
      request<{ message: string; confirmedCount: number; last_checked_at: string }>(
        '/staff/spaces/bulk-confirm',
        {
          method: 'POST',
          body: JSON.stringify({ space_ids }),
        }
      ),
    getReports: () => request<{ reports: any[] }>('/staff/reports'),
    hideReport: (id: string) =>
      request<{ message: string }>(`/staff/reports/${id}/hide`, {
        method: 'POST',
      }),
    getHolds: () => request<{ holds: Hold[] }>('/staff/holds'),
    releaseHold: (id: string) =>
      request<{ message: string }>(`/staff/holds/${id}/release`, {
        method: 'POST',
      }),
    getAudit: () => request<{ logs: AuditLog[] }>('/staff/audit'),
    getSettings: () => request<{ settings: SystemSettings }>('/staff/settings'),
    updateSettings: (settings: { [key: string]: string | number }) =>
      request<{ message: string }>('/staff/settings', {
        method: 'PUT',
        body: JSON.stringify({ settings }),
      }),
    // Seating management
    seating: {
      getReservations: (params: { status?: string; date?: string; building_id?: string; space_id?: string } = {}) => {
        const q = new URLSearchParams();
        if (params.status) q.set('status', params.status);
        if (params.date) q.set('date', params.date);
        if (params.building_id) q.set('building_id', params.building_id);
        if (params.space_id) q.set('space_id', params.space_id);
        return request<{ reservations: SeatReservation[] }>(`/staff/seating/reservations?${q.toString()}`);
      },
      toggleBlock: (seatId: string, block_reason?: string) =>
        request<{ message: string; seat: Seat }>(`/staff/seating/seats/${seatId}/toggle-block`, {
          method: 'POST',
          body: JSON.stringify({ block_reason }),
        }),
      addSeat: (seatData: any) =>
        request<{ message: string; id: string }>('/staff/seating/seats', {
          method: 'POST',
          body: JSON.stringify(seatData),
        }),
      updateSeat: (seatId: string, seatData: any) =>
        request<{ message: string }>(`/staff/seating/seats/${seatId}`, {
          method: 'PUT',
          body: JSON.stringify(seatData),
        }),
      cancelReservation: (id: string, reason?: string) =>
        request<{ message: string }>(`/staff/seating/reservations/${id}/cancel`, {
          method: 'POST',
          body: JSON.stringify({ reason }),
        }),
      checkInReservation: (id: string) =>
        request<{ message: string }>(`/staff/seating/reservations/${id}/check-in`, {
          method: 'POST',
        }),
    },
  },
};

export { ApiError };
