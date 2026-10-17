import { useAuth } from '../auth/AuthProvider';
import { useGroups, useHousehold, useHouseholdAttendance, useMeetingsByIds } from '../api';
import { useT, type MessageKey } from '../i18n';
import { klTime } from '../../shared/dates';
import type { Group, Meeting } from '../../shared/types';

/** e.g. "主日 · 2026-10-18", "小组 · 青年小组 · 周五查经", "活动 · 圣诞晚会". */
function meetingLabel(t: (k: MessageKey) => string, m: Meeting | undefined, groups: Group[], date: string): string {
  if (!m) return date;
  if (m.type === 'sunday') return `${t('rec.sunday')} · ${m.date}`;
  if (m.type === 'event') return `${t('rec.event')} · ${m.title}`;
  const group = groups.find((g) => g.id === m.groupId)?.name;
  return [t('rec.group'), group, group !== m.title ? m.title : undefined].filter(Boolean).join(' · ');
}

/** Recent check-ins for the signed-in member's household. */
export default function HistoryPage() {
  const { t } = useT();
  const { user } = useAuth();
  const family = useHousehold(user?.householdId);
  const attendance = useHouseholdAttendance((family ?? []).map((p) => p.id));
  const meetings = useMeetingsByIds((attendance ?? []).map((a) => a.meetingId)) ?? [];
  const groups = useGroups() ?? [];
  const nameOf = (id: string) => family?.find((p) => p.id === id)?.name ?? '';

  return (
    <div>
      <h1>{t('history.title')}</h1>
      <p className="muted">{t('history.hint')}</p>
      <div className="card">
        {!attendance ? <p className="muted">{t('common.loading')}</p> : attendance.length === 0 ? <p className="muted">{t('mydata.noRecords')}</p> : (
          <ul className="list">
            {attendance.map((a) => (
              <li key={a.meetingId + a.personId}>
                <div>
                  <div>{meetingLabel(t, meetings.find((m) => m.id === a.meetingId), groups, a.date)}</div>
                  <div className="muted small">{nameOf(a.personId)} · {t(`method.${a.method}` as MessageKey)}</div>
                </div>
                <span className="muted small" style={{ whiteSpace: 'nowrap' }}>{`${a.date} ${klTime(a.at)}`}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
