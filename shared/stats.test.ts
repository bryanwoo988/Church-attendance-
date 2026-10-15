import { describe, it, expect } from 'vitest';
import { attendanceRates } from './stats';
import type { Attendance, Meeting, Person, Group } from './types';

const P = (id: string, over: Partial<Person> = {}): Person => ({ id, name: id, householdId: 'h', kind: 'adult', status: 'member', active: true, visitCount: 0, createdAt: new Date('2026-01-01'), ...over });
const S = (date: string): Meeting => ({ id: `sunday-${date}`, type: 'sunday', title: '主日', date, checkinMode: 'always' });
const A = (meetingId: string, personId: string, date: string): Attendance => ({ meetingId, personId, date, method: 'scanner', at: new Date() });

const sundays = ['2026-10-04', '2026-10-11', '2026-10-18', '2026-10-25'].map(S);
const from = '2026-10-01';
const to = '2026-10-31';

describe('attendanceRates', () => {
  it('counts expected Sundays from the first visit', () => {
    const people = [P('new', { firstVisitDate: '2026-10-18', status: 'visitor' })];
    const att = [A('sunday-2026-10-18', 'new', '2026-10-18'), A('sunday-2026-10-25', 'new', '2026-10-25')];
    const r = attendanceRates({ people, meetings: sundays, attendance: att, groups: [], from, to });
    expect(r.personRates[0]).toEqual({ personId: 'new', attended: 2, expected: 2, rate: 1 });
  });

  it('gives null rate when nothing was expected', () => {
    const people = [P('late', { firstVisitDate: '2026-11-01' })];
    const r = attendanceRates({ people, meetings: sundays, attendance: [], groups: [], from, to });
    expect(r.personRates[0].rate).toBeNull();
  });

  it('includes group meetings only for group members, and averages group rates excluding visitors', () => {
    const g: Group = { id: 'g1', name: 'G', leaderUids: [], memberPersonIds: ['a', 'b', 'v'] };
    const gm: Meeting = { id: 'gm1', type: 'group', title: 'G', date: '2026-10-07', groupId: 'g1', checkinMode: 'always' };
    const people = [P('a'), P('b'), P('v', { status: 'visitor' }), P('x')];
    const att = [A('gm1', 'a', '2026-10-07'), A('gm1', 'v', '2026-10-07')];
    const r = attendanceRates({ people, meetings: [...sundays, gm], attendance: att, groups: [g], from, to });
    expect(r.personRates.find((p) => p.personId === 'x')!.expected).toBe(4);
    expect(r.personRates.find((p) => p.personId === 'a')!.expected).toBe(5);
    expect(r.groupRates).toEqual([{ groupId: 'g1', rate: 0.5 }]);
  });
});

import { groupAttendanceTable } from './stats';

describe('groupAttendanceTable', () => {
  it('builds member rows with marks per group meeting and a rate', () => {
    const g: Group = { id: 'g1', name: 'G', leaderUids: [], memberPersonIds: ['a', 'b'] };
    const m1: Meeting = { id: 'gm1', type: 'group', title: 'G', date: '2026-10-07', groupId: 'g1', checkinMode: 'always' };
    const m2: Meeting = { id: 'gm2', type: 'group', title: 'G', date: '2026-10-14', groupId: 'g1', checkinMode: 'always' };
    const other: Meeting = { id: 'x', type: 'group', title: 'X', date: '2026-10-14', groupId: 'g2', checkinMode: 'always' };
    const people = [P('a', { name: 'Ann' }), P('b', { name: 'Ben', firstVisitDate: '2026-10-10' }), P('c')];
    const att = [A('gm1', 'a', '2026-10-07'), A('gm2', 'a', '2026-10-14'), A('gm2', 'b', '2026-10-14')];
    const t = groupAttendanceTable(g, people, [m2, other, m1], att);
    expect(t.meetings.map((m) => m.id)).toEqual(['gm1', 'gm2']);
    expect(t.rows).toEqual([
      { personId: 'a', name: 'Ann', marks: [true, true], attended: 2, expected: 2, rate: 1 },
      { personId: 'b', name: 'Ben', marks: [null, true], attended: 1, expected: 1, rate: 1 },
    ]);
  });
});
