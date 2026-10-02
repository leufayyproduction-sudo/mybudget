import type {Transaction} from './index';
const textCell=(value:string)=>`"${(/^[\s]*[=+@-]/.test(value)?"'":'')+value.replaceAll('"','""')}"`;
export function transactionsCsv(transactions:Transaction[]) {
 return '\uFEFFTanggal;Jenis;Nominal_Rp;Kategori;Deskripsi\r\n'+transactions.map(t=>[textCell(t.date),textCell(t.type==='income'?'Pemasukan':'Pengeluaran'),String(t.amount),textCell(t.category),textCell(t.description)].join(';')).join('\r\n');
}
