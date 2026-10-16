import { attendanceRates, personStart, type RateInput } from './stats';
import { senToRinggit } from './money';
import type { Offering } from './types';

export type Cell = string | number | null;
export interface Sheet { name: string; rows: Cell[][] }

const METHOD: Record<string, string> = { scanner: '签到员 Scanner', self: '自助 Self', visitorForm: '新朋友表格 Welcome form' };
const STATUS: Record<string, string> = { visitor: '新朋友 Newcomer', regular: '常来 Regular', member: '会友 Member' };
const DELETED = '（已删除）';

/** Rows for the Excel export. Pure: no Excel library here. */
export function buildExportSheets(input: RateInput & { offerings: Offering[] }): Sheet[] {
  const { people, meetings, attendance, offerings, from, to } = input;
  const nameOf = (id: string) => people.find((p) => p.id === id)?.name ?? DELETED;
  const inRange = <T extends { date: string }>(xs: T[]) => xs.filter((x) => x.date >= from && x.date <= to).sort((a, b) => a.date.localeCompare(b.date));
  const ms = inRange(meetings);
  const meetingTitle = (id: string) => meetings.find((m) => m.id === id)?.title ?? id;
  const offs = inRange(offerings);
  const att = inRange(attendance);

  const attendanceSheet: Sheet = {
    name: '出席记录 Attendance',
    rows: [['日期 Date', '聚会 Meeting', '名字 Name', '方式 Method'], ...att.map((a) => [a.date, meetingTitle(a.meetingId), nameOf(a.personId), METHOD[a.method] ?? a.method])],
  };

  const offeringSheet: Sheet = {
    name: '奉献记录 Offerings',
    rows: [['日期 Date', '名字 Name', '类别 Category', '金额 RM'], ...offs.map((o) => [o.date, nameOf(o.personId), o.category, senToRinggit(o.amountSen)])],
  };

  // Offerings per person per date, summed.
  const offBy = new Map<string, number>();
  for (const o of offs) offBy.set(`${o.personId}|${o.date}`, (offBy.get(`${o.personId}|${o.date}`) ?? 0) + o.amountSen);
  const attended = new Set(att.map((a) => `${a.meetingId}|${a.personId}`));
  const combined: Cell[][] = [['名字 Name', '日期 Date', '聚会 Meeting', '出席 Attended', '当天奉献 RM']];
  for (const p of people.filter((x) => x.active)) {
    const start = personStart(p);
    const used = new Set<string>();
    for (const m of ms.filter((x) => x.date >= start)) {
      const key = `${p.id}|${m.date}`;
      const putOffering = m.type === 'sunday' && !used.has(key);
      if (putOffering) used.add(key);
      combined.push([p.name, m.date, m.title, attended.has(`${m.id}|${p.id}`) ? '✓' : '', putOffering && offBy.has(key) ? senToRinggit(offBy.get(key)!) : null]);
    }
    for (const [key, sen] of offBy) {
      const [pid, date] = key.split('|');
      if (pid === p.id && !used.has(key)) combined.push([p.name, date, '—', '', senToRinggit(sen)]);
    }
  }

  const { personRates } = attendanceRates(input);
  const ratesSheet: Sheet = {
    name: '出席率 Rates',
    rows: [
      ['名字 Name', '身份 Status', '出席 Attended', '应出席 Expected', '出席率 Rate'],
      ...personRates.map((r) => {
        const p = people.find((x) => x.id === r.personId)!;
        return [p.name, STATUS[p.status] ?? p.status, r.attended, r.expected, r.rate];
      }),
    ],
  };

  const totals = new Map<string, { name: string; count: number; sen: number }>();
  for (const o of offs) {
    const name = nameOf(o.personId);
    const key = o.personId === 'deleted' || name === DELETED ? 'deleted' : o.personId;
    const t = totals.get(key) ?? { name, count: 0, sen: 0 };
    t.count += 1;
    t.sen += o.amountSen;
    totals.set(key, t);
  }
  const totalRows = [...totals.values()].sort((a, b) => b.sen - a.sen);
  const totalsSheet: Sheet = {
    name: '奉献合计 Totals',
    rows: [
      ['名字 Name', '笔数 Count', '合计 RM'],
      ...totalRows.map((t) => [t.name, t.count, senToRinggit(t.sen)]),
      ['总计 Total', offs.length, senToRinggit(offs.reduce((s, o) => s + o.amountSen, 0))],
    ],
  };

  return [attendanceSheet, offeringSheet, totalsSheet, { name: '合并表 Combined', rows: combined }, ratesSheet];
}
