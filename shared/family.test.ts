import { describe, it, expect } from 'vitest';
import { todaysAttendees } from './family';

const fam = ['dad', 'mum', 'son', 'baby'];

describe('todaysAttendees', () => {
  it("uses the family's list for today, plus whoever was scanned", () => {
    expect(todaysAttendees({ date: '2026-10-18', personIds: ['dad', 'mum'] }, '2026-10-18', fam, 'son')).toEqual(['son', 'dad', 'mum']);
  });
  it('keeps the scanned person first without duplicating', () => {
    expect(todaysAttendees({ date: '2026-10-18', personIds: ['dad', 'mum'] }, '2026-10-18', fam, 'mum')).toEqual(['mum', 'dad']);
  });
  it("ignores last week's list", () => {
    expect(todaysAttendees({ date: '2026-10-11', personIds: ['dad', 'mum'] }, '2026-10-18', fam, 'dad')).toBeNull();
  });
  it('ignores removed members and an empty list', () => {
    expect(todaysAttendees({ date: '2026-10-18', personIds: ['gone', 'dad'] }, '2026-10-18', fam, 'dad')).toEqual(['dad']);
    expect(todaysAttendees({ date: '2026-10-18', personIds: [] }, '2026-10-18', fam, 'dad')).toBeNull();
    expect(todaysAttendees(undefined, '2026-10-18', fam, 'dad')).toBeNull();
  });
});
