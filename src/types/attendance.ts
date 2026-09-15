import type { Timestamp } from './index';

export type AttendanceSessionStatus = 'active' | 'paused' | 'closed';
export type AttendanceRecordStatus = 'present' | 'late' | 'excused';

export interface AttendanceSession {
  id: string;
  title: string;
  description?: string;
  date: string;              // YYYY-MM-DD
  startTime: string;         // HH:MM e.g. "17:00"
  endTime: string;           // HH:MM e.g. "18:00"
  status: AttendanceSessionStatus;
  secureToken: string;       // Unique cryptographic token to prevent URL guess
  sessionCode?: string;      // Compatibility for DB schema session_code
  session_code?: string;
  total_attended?: number;
  timeWindowMinutes?: number; // Optional check-in window
  createdBy: string;         // Admin UID/email
  createdByName: string;
  createdAt: Timestamp | string;
  closedAt?: Timestamp | string | null;
  attendeesCount: number;
}

export interface AttendanceRecord {
  id: string;                // usually `${sessionId}_${employeeId}` for uniqueness
  sessionId: string;
  sessionTitle: string;
  employeeId: string;        // user uid
  employeeName: string;
  employeeCode: string;      // e.g. GOGA-33001
  employeePhoto?: string;
  checkInTime: string;       // formatted e.g. "5:14 PM"
  checkInTimestamp: Timestamp | string;
  date: string;              // YYYY-MM-DD
  status: AttendanceRecordStatus;
  createdAt: Timestamp | string;
}
