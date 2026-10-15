import { klDate } from './dates';
import type { Attendance, Group, Meeting, Person } from './types';

export interface RateInput {
  people: Person[];
  meetings: Meeting[];
  attendance: Attendance[];
  groups: Group[];
  from: string;
  to: string;
}
export interface PersonRate { personId: string; attended: number; expected: number; rate: number | null }

export function personStart(p: Person): string {
  return p.firstVisitDate ?? klDate(p.createdAt);
}

const ratio = (a: number, e: number) => (e === 0 ? null : Math.round((a / e) * 100) / 100);

/** Meetings a person was expected at: Sundays plus their groups' meetings, from their first visit. */
export function expectedMeetings(p: Person, meetings: Meeting[], groups: Group[], from: string, to: string): Meeting[] {
  const start = personStart(p);
  const myGroups = new Set(groups.filter((g) => g.memberPersonIds.includes(p.id)).map((g) => g.id));
  return meetings.filter(
    (m) => m.date >= from && m.date <= to && m.date >= start && (m.type === 'sunday' || (m.type === 'group' && m.groupId && myGroups.has(m.groupId))),
  );
}

export function attendanceRates(input: RateInput): { personRates: PersonRate[]; groupRates: { groupId: string; rate: number | null }[] } {
  const { people, meetings, attendance, groups, from, to } = input;
  const seen = new Set(attendance.map((a) => `${a.meetingId}|${a.personId}`));
  const count = (p: Person, ms: Meeting[]) => ms.filter((m) => seen.has(`${m.id}|${p.id}`)).length;

  const personRates = people
    .filter((p) => p.active)
    .map((p) => {
      const exp = expectedMeetings(p, meetings, groups, from, to);
      const attended = count(p, exp);
      return { personId: p.id, attended, expected: exp.length, rate: ratio(attended, exp.length) };
    });

  const groupRates = groups.map((g) => {
    const gms = meetings.filter((m) => m.groupId === g.id && m.date >= from && m.date <= to);
    const rates = people
      .filter((p) => p.active && p.status !== 'visitor' && g.memberPersonIds.includes(p.id))
      .map((p) => {
        const exp = gms.filter((m) => m.date >= personStart(p));
        return ratio(count(p, exp), exp.length);
      })
      .filter((r): r is number => r !== null);
    return { groupId: g.id, rate: rates.length ? Math.round((rates.reduce((a, b) => a + b, 0) / rates.length) * 100) / 100 : null };
  });

  return { personRates, groupRates };
}

export interface GroupRow { personId: string; name: string; marks: (boolean | null)[]; attended: number; expected: number; rate: number | null }

/** One row per active group member, one column per group meeting; null = before they first came. */
export function groupAttendanceTable(group: Group, people: Person[], meetings: Meeting[], attendance: Attendance[]): { meetings: Meeting[]; rows: GroupRow[] } {
  const ms = meetings.filter((m) => m.groupId === group.id).sort((a, b) => a.date.localeCompare(b.date));
  const seen = new Set(attendance.map((a) => `${a.meetingId}|${a.personId}`));
  const rows = group.memberPersonIds
    .map((id) => people.find((p) => p.id === id && p.active))
    .filter((p): p is Person => !!p)
    .map((p) => {
      const start = personStart(p);
      const marks = ms.map((m) => (m.date < start ? null : seen.has(`${m.id}|${p.id}`)));
      const expected = marks.filter((x) => x !== null).length;
      const attended = marks.filter((x) => x === true).length;
      return { personId: p.id, name: p.name, marks, attended, expected, rate: ratio(attended, expected) };
    });
  return { meetings: ms, rows };
}
