export type Attendance = 'pending' | 'attending' | 'declined';
export interface Guest {
  id: string;
  name: string;
  token: string;
  status: Attendance;
  children_count: number;
  message: string;
  created_at: string;
  updated_at: string;
}
export interface Invitation {
  name: string;
  status: Attendance;
  childrenCount: number;
  message: string;
  deadline: string | null;
  closed: boolean;
}
export interface Reply {
  status: Exclude<Attendance, 'pending'>;
  childrenCount: number;
  message: string;
}
