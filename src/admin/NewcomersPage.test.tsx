import { describe, it, expect } from 'vitest';
import { newcomerRows } from './NewcomersPage';
import type { Person } from '../../shared/types';

const P = (over: Partial<Person>): Person => ({ id: 'x', name: 'n', householdId: 'h', kind: 'adult', status: 'visitor', active: true, visitCount: 1, createdAt: new Date(), ...over });

describe('newcomerRows', () => {
  it('computes days since last visit and sorts newest first', () => {
    const rows = newcomerRows([
      P({ id: 'a', lastVisitDate: '2026-10-11', firstVisitDate: '2026-10-04', visitCount: 2 }),
      P({ id: 'b', lastVisitDate: '2026-10-18', firstVisitDate: '2026-10-18' }),
      P({ id: 'c', status: 'member', lastVisitDate: '2026-10-18' }),
      P({ id: 'd', active: false, lastVisitDate: '2026-10-18' }),
    ], '2026-10-18');
    expect(rows.map((r) => r.person.id)).toEqual(['b', 'a']);
    expect(rows[1].daysSince).toBe(7);
    expect(rows[0].daysSince).toBe(0);
  });
});
