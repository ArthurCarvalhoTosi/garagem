import type { DossierLog } from './dossier';

export type CsvLog = Omit<DossierLog, 'photo'> & { notes: string | null };

const HEADER = [
  'Data',
  'Km',
  'Manutenção',
  'Custo (R$)',
  'Marca/especificação',
  'Observações',
  'Registrado em',
  'Com comprovante',
];

// Quoted only when needed; a quote inside doubles, as Excel expects.
const cell = (v: string) => (/[;"\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
const date = (d: string) => d.split('-').reverse().join('/');

/**
 * The car's history as a spreadsheet for Brazilian Excel: ";" between columns, decimal comma,
 * dd/mm/aaaa dates and UTF-8 with a BOM, so it opens right with two taps. Photos stay out.
 */
export function logsCsv(logs: CsvLog[]): string {
  const rows = logs.map((l) => [
    date(l.performedAt),
    String(l.km),
    l.name,
    l.costCents == null ? '' : (l.costCents / 100).toFixed(2).replace('.', ','),
    l.brandSpec ?? '',
    l.notes ?? '',
    date(l.registeredOn),
    l.hasReceipt ? 'Sim' : 'Não',
  ]);
  return '﻿' + [HEADER, ...rows].map((r) => r.map(cell).join(';')).join('\r\n') + '\r\n';
}
