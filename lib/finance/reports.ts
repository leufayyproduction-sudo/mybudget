import { summary, type Transaction } from './index';

export function shiftMonth(month: string, offset: number) {
 if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error('Bulan tidak valid.');
 const [year, m] = month.split('-').map(Number);
 const d = new Date(Date.UTC(year, m - 1 + offset, 1));
 return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function compareAmount(current: number, previous: number) {
 if (previous === 0) return { percent: null, label: current > 0 ? 'Baru' : 'Tidak ada pembanding' };
 const percent = (current - previous) / previous * 100;
 return { percent, label: `${percent > 0 ? '+' : ''}${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 }).format(percent)}%` };
}

export function report(transactions: Transaction[], month: string) {
 const series = Array.from({ length: 6 }, (_, i) => {
  const key = shiftMonth(month, i - 5);
  const totals = summary(transactions, 0, key);
  return { month: key, income: totals.income, expense: totals.expense };
 });
 const current = series[5], previous = series[4];
 const grouped = new Map<string, number>();
 for (const t of transactions) if (t.type === 'expense' && t.date.startsWith(month)) grouped.set(t.category, (grouped.get(t.category) || 0) + t.amount);
 const categories = [...grouped].map(([name, amount]) => ({ name, amount, share: current.expense ? amount / current.expense * 100 : 0 })).sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name, 'id'));
 return { series, current, previous, categories, incomeChange: compareAmount(current.income, previous.income), expenseChange: compareAmount(current.expense, previous.expense), hasData: series.some(s => s.income > 0 || s.expense > 0) };
}
