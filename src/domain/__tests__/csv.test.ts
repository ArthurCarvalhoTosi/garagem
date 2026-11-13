import { logsCsv, type CsvLog } from '../csv';

const log = (over: Partial<CsvLog> = {}): CsvLog => ({
  name: 'Troca de óleo e filtro',
  performedAt: '2026-10-17',
  km: 40500,
  costCents: 123450,
  brandSpec: 'Mobil 5W-30',
  notes: null,
  registeredOn: '2026-10-18',
  hasReceipt: true,
  ...over,
});

test('Brazilian Excel layout: BOM, semicolons, decimal comma, dd/mm/aaaa, CRLF', () => {
  const csv = logsCsv([log(), log({ costCents: null, brandSpec: null, hasReceipt: false })]);
  expect(csv.startsWith('﻿')).toBe(true);
  expect(csv.slice(1).split('\r\n')).toEqual([
    'Data;Km;Manutenção;Custo (R$);Marca/especificação;Observações;Registrado em;Com comprovante',
    '17/10/2026;40500;Troca de óleo e filtro;1234,50;Mobil 5W-30;;18/10/2026;Sim',
    '17/10/2026;40500;Troca de óleo e filtro;;;;18/10/2026;Não',
    '',
  ]);
});

test('a cell with a separator, quote or line break is quoted', () => {
  const csv = logsCsv([log({ notes: 'Oficina "do Zé"; troquei\no filtro', brandSpec: 'Shell' })]);
  expect(csv).toContain(';Shell;"Oficina ""do Zé""; troquei\no filtro";');
});

test('text that starts like a formula is shown, not run', () => {
  const csv = logsCsv([
    log({ notes: '=HYPERLINK("http://x")', brandSpec: '+1', name: '@SUM(A1)' }),
  ]);
  expect(csv).toContain(`;'@SUM(A1);1234,50;'+1;"'=HYPERLINK(""http://x"")";`);
});

test('no logs: only the header', () => {
  expect(logsCsv([]).slice(1)).toBe(
    'Data;Km;Manutenção;Custo (R$);Marca/especificação;Observações;Registrado em;Com comprovante\r\n',
  );
});
