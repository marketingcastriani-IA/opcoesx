// B3 Calendar Engine - Centralized ticker identification and business day calculations

const CALL_LETTERS = 'ABCDEFGHIJKL';
const PUT_LETTERS = 'MNOPQRSTUVWX';

// Hardcoded B3 expiry dates for 2026 (3rd Friday rule, adjusted for holidays)
const EXPIRY_CALENDAR_2026: Record<number, string> = {
  1: '2026-01-16',
  2: '2026-02-20',
  3: '2026-03-20',
  4: '2026-04-17',
  5: '2026-05-15',
  6: '2026-06-19',
  7: '2026-07-17',
  8: '2026-08-21',
  9: '2026-09-18',
  10: '2026-10-16',
  11: '2026-11-19', // Thu - anticipated from 20/11 (Consciência Negra)
  12: '2026-12-18',
};

// Brazilian bank holidays 2026
const BANK_HOLIDAYS_2026 = new Set([
  '2026-01-01', // Confraternização Universal
  '2026-02-16', // Carnaval
  '2026-02-17', // Carnaval
  '2026-04-03', // Sexta-feira Santa
  '2026-04-21', // Tiradentes
  '2026-05-01', // Dia do Trabalho
  '2026-06-04', // Corpus Christi
  '2026-09-07', // Independência
  '2026-10-12', // N. Sra. Aparecida
  '2026-11-02', // Finados
  '2026-11-15', // Proclamação da República
  '2026-11-20', // Consciência Negra
  '2026-12-25', // Natal
]);

export const EXPIRY_OPTIONS = [
  { label: 'Jan 2026 (16/01)', date: '2026-01-16', month: 1 },
  { label: 'Fev 2026 (20/02)', date: '2026-02-20', month: 2 },
  { label: 'Mar 2026 (20/03)', date: '2026-03-20', month: 3 },
  { label: 'Abr 2026 (17/04)', date: '2026-04-17', month: 4 },
  { label: 'Mai 2026 (15/05)', date: '2026-05-15', month: 5 },
  { label: 'Jun 2026 (19/06)', date: '2026-06-19', month: 6 },
  { label: 'Jul 2026 (17/07)', date: '2026-07-17', month: 7 },
  { label: 'Ago 2026 (21/08)', date: '2026-08-21', month: 8 },
  { label: 'Set 2026 (18/09)', date: '2026-09-18', month: 9 },
  { label: 'Out 2026 (16/10)', date: '2026-10-16', month: 10 },
  { label: 'Nov 2026 (19/11)', date: '2026-11-19', month: 11 },
  { label: 'Dez 2026 (18/12)', date: '2026-12-18', month: 12 },
];

function formatDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, '0');
  const d = `${date.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getOptionTypeFromLetter(letter: string): 'call' | 'put' | null {
  const upper = letter.toUpperCase();
  if (CALL_LETTERS.includes(upper)) return 'call';
  if (PUT_LETTERS.includes(upper)) return 'put';
  return null;
}

export function getMonthFromLetter(letter: string): number | null {
  const upper = letter.toUpperCase();
  const callIdx = CALL_LETTERS.indexOf(upper);
  if (callIdx >= 0) return callIdx + 1;
  const putIdx = PUT_LETTERS.indexOf(upper);
  if (putIdx >= 0) return putIdx + 1;
  return null;
}

export function getExpiryFromTicker(ticker: string): Date | null {
  if (!ticker || ticker.length < 5) return null;
  const letter = ticker[4].toUpperCase();
  const month = getMonthFromLetter(letter);
  if (!month) return null;
  const expiryStr = EXPIRY_CALENDAR_2026[month];
  if (!expiryStr) return null;
  const [y, m, d] = expiryStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function countBusinessDays(from: Date, to: Date): number {
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const end = new Date(to.getFullYear(), to.getMonth(), to.getDate());
  if (end <= start) return 0;
  let count = 0;
  const current = new Date(start);
  while (current < end) {
    current.setDate(current.getDate() + 1);
    const day = current.getDay();
    const key = formatDateKey(current);
    if (day !== 0 && day !== 6 && !BANK_HOLIDAYS_2026.has(key)) {
      count += 1;
    }
  }
  return count;
}

export function getUnderlyingRoot(ticker: string): string {
  if (!ticker) return '';
  return ticker.slice(0, 4).toUpperCase();
}
