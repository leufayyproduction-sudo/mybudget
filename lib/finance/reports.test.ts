import { test } from 'node:test';
import assert from 'node:assert/strict';
import { report, shiftMonth, compareAmount } from './reports';
import type { Transaction } from './index';
const tx = (amount: number, date: string, type: Transaction['type'] = 'expense', category = 'Makan & minum'): Transaction => ({ id: `${date}-${amount}`, amount, date, type, category, description: '' });
test('laporan kosong tidak menghasilkan persen tak hingga atau NaN', () => {
 const r = report([], '2026-01');
 assert.equal(r.hasData, false); assert.deepEqual(r.categories, []);
 assert.equal(r.incomeChange.percent, null); assert.equal(r.incomeChange.label, 'Tidak ada pembanding');
 assert.equal(r.series[0].month, '2025-08');
});
test('pembanding nol dibedakan dari penurunan ke nol', () => {
 assert.equal(compareAmount(20000, 0).label, 'Baru');
 assert.equal(compareAmount(0, 20000).percent, -100);
 assert.equal(compareAmount(20000, 10000).percent, 100);
});
test('Rp20.000 dan kategori dihitung dari transaksi aktual saja', () => {
 const r = report([tx(20000, '2026-01-02', 'income'), tx(5000, '2026-01-03'), tx(3000, '2026-01-04'), tx(2000, '2026-01-05', 'expense', 'Transportasi'), tx(99999, '2026-02-01'), tx(10000, '2025-12-31', 'income')], '2026-01');
 assert.equal(r.current.income, 20000); assert.equal(r.current.expense, 10000);
 assert.deepEqual(r.categories[0], { name: 'Makan & minum', amount: 8000, share: 80 });
 assert.equal(r.incomeChange.percent, 100); assert.equal(r.expenseChange.label, 'Baru');
});
test('pergeseran bulan menangani tahun dan menolak bulan salah', () => {
 assert.equal(shiftMonth('2026-01', -1), '2025-12');
 assert.throws(() => shiftMonth('2026-13', 0));
});
