import { backupReminder } from '../backupReminder';

const TODAY = '2026-11-03';
const state = (over: Partial<Parameters<typeof backupReminder>[0]> = {}) => ({
  lastBackupAt: null,
  firstCarAt: '2026-01-01',
  snoozedUntil: null,
  ...over,
});

test('never backed up: only once the first car is over 30 days old', () => {
  expect(backupReminder(state(), TODAY)).toBe('Nunca feito');
  expect(backupReminder(state({ firstCarAt: '2026-10-04' }), TODAY)).toBeNull(); // 30 days
  expect(backupReminder(state({ firstCarAt: '2026-10-03' }), TODAY)).not.toBeNull();
  expect(backupReminder(state({ firstCarAt: null }), TODAY)).toBeNull();
});

test('backed up: only once it is over 90 days old, in whole months', () => {
  expect(backupReminder(state({ lastBackupAt: '2026-08-05' }), TODAY)).toBeNull(); // 90 days
  expect(backupReminder(state({ lastBackupAt: '2026-08-04' }), TODAY)).toBe('Último há 3 meses');
  expect(backupReminder(state({ lastBackupAt: '2026-07-01' }), TODAY)).toMatch(/há 4 meses/);
});

test('"Agora não" hides it until the snooze ends', () => {
  expect(backupReminder(state({ snoozedUntil: '2026-11-04' }), TODAY)).toBeNull();
  expect(backupReminder(state({ snoozedUntil: TODAY }), TODAY)).not.toBeNull();
});
