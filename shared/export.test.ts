import { describe, it, expect } from 'vitest';
import { buildExportSheets } from './export';
import type { Attendance, Meeting, Offering, Person } from './types';

const P = (id: string, name: string, over: Partial<Person> = {}): Person => ({ id, name, householdId: 'h', kind: 'adult', status: 'member', active: true, visitCount: 0, createdAt: new Date('2026-01-01'), ...over });
const sun: Meeting = { id: 'sunday-2026-10-18', type: 'sunday', title: '主日', date: '2026-10-18', checkinMode: 'always' };
const O = (personId: string, date: string, amountSen: number): Offering => ({ id: date + personId, uid: 'u', personId, householdId: 'h', date, amountSen, category: 'x', createdAt: new Date() });

const people = [P('mom', 'Mary'), P('kid', 'Kid', { kind: 'child' })];
const attendance: Attendance[] = [{ meetingId: sun.id, personId: 'kid', date: sun.date, method: 'scanner', at: new Date() }];
const input = { people, meetings: [sun], attendance, groups: [], from: '2026-10-01', to: '2026-10-31' };

function sheet(name: string, offerings: Offering[] = []) {
  const s = buildExportSheets({ ...input, offerings }).find((x) => x.name === name);
  if (!s) throw new Error('missing sheet ' + name);
  return s.rows;
}

describe('buildExportSheets', () => {
  it('produces the four sheets with bilingual headers', () => {
    const names = buildExportSheets({ ...input, offerings: [] }).map((s) => s.name);
    expect(names).toEqual(['出席记录 Attendance', '奉献记录 Offerings', '合并表 Combined', '出席率 Rates']);
    expect(sheet('出席记录 Attendance')[0]).toEqual(['日期 Date', '聚会 Meeting', '名字 Name', '方式 Method']);
  });

  it('shows child attendance under the child', () => {
    const rows = sheet('出席记录 Attendance');
    expect(rows[1]).toEqual(['2026-10-18', '主日', 'Kid', '签到员 Scanner']);
  });

  it('puts a Sunday offering on that Sunday row of the combined sheet', () => {
    const rows = sheet('合并表 Combined', [O('mom', '2026-10-18', 5000)]);
    expect(rows).toContainEqual(['Mary', '2026-10-18', '主日', '', 50]);
    expect(rows).toContainEqual(['Kid', '2026-10-18', '主日', '✓', null]);
  });

  it('puts a weekday offering on a row without a meeting', () => {
    const rows = sheet('合并表 Combined', [O('mom', '2026-10-21', 2000)]);
    expect(rows).toContainEqual(['Mary', '2026-10-21', '—', '', 20]);
  });

  it('lists offerings in ringgit with deleted names masked', () => {
    const rows = sheet('奉献记录 Offerings', [O('mom', '2026-10-18', 5050), O('deleted', '2026-10-18', 100)]);
    expect(rows[1]).toEqual(['2026-10-18', 'Mary', 'x', 50.5]);
    expect(rows[2]).toEqual(['2026-10-18', '（已删除）', 'x', 1]);
  });
});
