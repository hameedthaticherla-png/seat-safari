export type Role = 'guest' | 'student' | 'staff';

export type ZoneType = 'Quiet' | 'Discussion' | 'Flexible';

export type FacilityType = 'power' | 'wifi' | 'board' | 'desk_chair' | 'window_view' | 'ergonomic' | 'pc_terminal' | 'display_screen';

export type ReportStatus = 'Free' | 'Filling up' | 'Full';

export type SeatType = 'standard' | 'socket' | 'window' | 'computer' | 'ergonomic' | 'group_room';

export type SeatStatus = 'available' | 'held' | 'booked' | 'blocked' | 'selected';

export interface User {
  id?: string;
  email?: string;
  role: Role;
  display_name: string;
  staff_scope?: string | null;
}

export interface LatestReport {
  id: string;
  status: ReportStatus;
  created_at: string;
  age_minutes: number;
  age_text: string;
  flagged?: boolean;
}

export interface Staleness {
  is_stale: boolean;
  days_ago: number;
  last_checked_date: string;
}

export interface UsualBusy {
  id: string;
  space_id: string;
  day_type: string;
  start_time: string;
  end_time: string;
  busy_level: 'busy' | 'moderate' | 'quiet' | 'unknown';
  notes?: string;
}

export interface Space {
  id: string;
  name: string;
  location: string;
  zone_type: ZoneType;
  zone_rule: string;
  facilities: string[];
  hours: string;
  only_if_no_class: boolean;
  hold_enabled: boolean;
  last_checked_at: string;
  owner_scope: string;
  description?: string;
  capacity_hint?: string;
  map_zone?: string;
  building_id?: string;
  floor_id?: string;
  layout_type?: 'grid' | 'tables' | 'group_room';
  front_label?: string;
  total_seats?: number;
  latest_report?: LatestReport | null;
  staleness?: Staleness;
  usual_busy?: UsualBusy[];
  busy_at_time?: {
    status: string;
    note: string;
  };
  is_favourite?: boolean;
  active_hold?: any;
  rank_score?: number;
  matched_all_needs?: boolean;
  suitabilityScore?: number;
  rationale?: string;
  isQuietFallbackForGroup?: boolean;
  can_edit?: boolean;
  is_stale?: boolean;
}

export interface Hold {
  id: string;
  room_id: string;
  room_name?: string;
  room_location?: string;
  status: 'active' | 'checked_in' | 'released' | 'expired' | 'cancelled_by_staff';
  start_time: string;
  end_time: string;
  checked_in_at?: string | null;
  checkin_seconds_remaining?: number;
  hold_seconds_remaining?: number;
  needs_checkin?: boolean;
}

export interface Building {
  id: string;
  name: string;
  code: string;
  campus: string;
  description?: string;
  hours: string;
  sort_order: number;
  floors?: Floor[];
}

export interface Floor {
  id: string;
  building_id: string;
  floor_number: number;
  name: string;
  description?: string;
  sort_order: number;
  spaces?: Space[];
}

export interface SpaceTable {
  id: string;
  space_id: string;
  table_number: string;
  label: string;
  shape: 'rectangle' | 'round' | 'booth' | 'square';
  capacity: number;
  x: number;
  y: number;
}

export interface Seat {
  id: string;
  space_id: string;
  table_id?: string | null;
  table_label?: string;
  table_number?: string;
  seat_number: string;
  row_label: string;
  col_index: number;
  seat_type: SeatType;
  facilities: string[];
  is_blocked: number | boolean;
  block_reason?: string | null;
  grid_x: number;
  grid_y: number;
  status?: SeatStatus;
  occupied?: number | boolean;
  occupied_by_me?: number | boolean;
  updated_at?: string | null;
  held_by_me?: boolean;
  held_seconds_remaining?: number;
  reservation_id?: string | null;
}

export interface SeatReservation {
  id: string;
  booking_reference: string;
  user_id: string;
  space_id: string;
  seat_id: string;
  seat_number?: string;
  row_label?: string;
  seat_type?: SeatType;
  seat_facilities?: string[];
  space_name?: string;
  space_location?: string;
  zone_type?: ZoneType;
  zone_rule?: string;
  building_name?: string;
  floor_name?: string;
  table_label?: string;
  student_name?: string;
  student_email?: string;
  reservation_date: string;
  start_time: string;
  end_time: string;
  status: 'held' | 'confirmed' | 'checked_in' | 'completed' | 'cancelled' | 'no_show' | 'expired';
  lifecycle?: 'upcoming' | 'active' | 'completed' | 'cancelled' | 'no_show';
  held_until?: string | null;
  checked_in_at?: string | null;
  cancelled_at?: string | null;
  cancellation_reason?: string | null;
  qr_code_token: string;
  notes?: string;
  can_cancel?: boolean;
  can_check_in?: boolean;
  checkin_deadline_minutes?: number;
  created_at: string;
}

export interface AuditLog {
  id: string;
  actor: string;
  actor_role: string;
  action: string;
  target: string;
  details?: string;
  timestamp: string;
}

export interface SystemSettings {
  [key: string]: {
    value: string;
    description: string;
  };
}
