export type Role = 'scanner' | 'leader' | 'finance' | 'admin';
export type PersonStatus = 'visitor' | 'regular' | 'member';
export type PersonKind = 'adult' | 'child';
export type MeetingType = 'sunday' | 'group' | 'event';
export type CheckinMode = 'always' | 'window';
export type AttendanceMethod = 'scanner' | 'self' | 'visitorForm';

export interface Person {
  id: string;
  name: string;
  householdId: string;
  kind: PersonKind;
  status: PersonStatus;
  phone?: string;
  accountUid?: string;
  firstVisitDate?: string;
  visitCount: number;
  lastVisitDate?: string;
  howHeard?: string;
  contactConsent?: boolean;
  /** No personal QR code (e.g. a baby): still counted when the family checks in. */
  noQr?: boolean;
  pdpaConsentAt?: Date;
  active: boolean;
  mergedInto?: string;
  createdAt: Date;
}

/** A saved group of family members, e.g. "Dad & Mum". */
export interface FamilyPreset {
  name: string;
  personIds: string[];
}

export interface Household {
  id: string;
  ownerUid?: string;
  /** Saved combinations to pick from quickly. */
  presets?: FamilyPreset[];
  /** Who is coming on `date` (KL), chosen by the family ahead of time. */
  today?: { date: string; personIds: string[] };
  createdAt?: Date;
}

export interface UserDoc {
  uid: string;
  personId: string;
  householdId: string;
  roles: Role[];
  lang?: 'zh' | 'en';
}

export interface Group {
  id: string;
  name: string;
  leaderUids: string[];
  memberPersonIds: string[];
}

export interface Meeting {
  id: string;
  type: MeetingType;
  title: string;
  date: string;
  groupId?: string;
  checkinMode: CheckinMode;
  windowStart?: Date;
  windowEnd?: Date;
  createdBy?: string;
  createdAt?: Date;
}

export interface Attendance {
  meetingId: string;
  personId: string;
  date: string;
  method: AttendanceMethod;
  byUid?: string;
  at: Date;
}

export interface Offering {
  id: string;
  uid: string;
  personId: string;
  householdId: string;
  date: string;
  amountSen: number;
  category: string;
  createdAt: Date;
  updatedAt?: Date;
}

export interface ChurchSettings {
  paymentQrDataUrl?: string;
  sunday: { weekday: number; start: string; end: string; checkinMode: CheckinMode };
  offeringCategories: string[];
  /** Members may check themselves in (app button / door poster). Off: door scanners only. */
  selfCheckin?: boolean;
}

export const DEFAULT_SETTINGS: ChurchSettings = {
  sunday: { weekday: 0, start: '09:00', end: '11:30', checkinMode: 'window' },
  offeringCategories: ['一般奉献 General'],
  selfCheckin: false,
};
