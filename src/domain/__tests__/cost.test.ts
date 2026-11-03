import { costSummary } from '../cost';

const TODAY = '2026-11-03';
const log = (performedAt: string, costCents: number | null) => ({ performedAt, costCents });
const reading = (readAt: string, km: number) => ({ readAt, km });

test('totals: all time, this calendar year, the last 12 months', () => {
  const logs = [
    log('2024-05-10', 100_00),
    log('2025-11-02', 200_00), // 12 months and a day ago
    log('2025-11-03', 300_00),
    log('2026-01-01', 400_00),
    log('2026-11-03', 500_00),
    log('2026-06-01', null),
  ];
  expect(costSummary(logs, [], TODAY)).toEqual({
    total: 1500_00,
    thisYear: 900_00,
    last12Months: 1200_00,
    perKm: null,
  });
});

test('per km: costs between the first and last reading of the year, over the km between them', () => {
  const logs = [log('2025-06-01', 9999_00), log('2026-02-01', 400_00), log('2026-08-01', 800_00)];
  const readings = [
    reading('2025-06-01', 10_000), // before the window: ignored
    reading('2026-01-15', 40_000),
    reading('2026-08-01', 44_000),
    reading('2026-10-01', 46_000),
  ];
  // R$ 1.200 over 6.000 km.
  expect(costSummary(logs, readings, TODAY).perKm).toBe(20);
});

test('per km stays empty until it can tell', () => {
  const logs = [log('2026-09-01', 500_00)];
  // Under 90 days of readings.
  expect(
    costSummary(logs, [reading('2026-08-10', 40_000), reading('2026-11-01', 43_000)], TODAY).perKm,
  ).toBeNull();
  // One reading, or no km driven.
  expect(costSummary(logs, [reading('2026-01-01', 40_000)], TODAY).perKm).toBeNull();
  expect(
    costSummary(logs, [reading('2026-01-01', 40_000), reading('2026-10-01', 40_000)], TODAY).perKm,
  ).toBeNull();
  // Under a cent per km.
  expect(
    costSummary(
      [log('2026-05-01', 10)],
      [reading('2026-01-01', 0), reading('2026-10-01', 20_000)],
      TODAY,
    ).perKm,
  ).toBeNull();
});

test('two readings on one day count by km', () => {
  const readings = [
    reading('2026-01-01', 40_500),
    reading('2026-01-01', 40_000),
    reading('2026-10-01', 41_000),
  ];
  expect(costSummary([log('2026-05-01', 100_00)], readings, TODAY).perKm).toBe(10);
});
