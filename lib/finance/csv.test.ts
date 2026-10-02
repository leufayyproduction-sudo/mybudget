import {test} from 'node:test';
import assert from 'node:assert/strict';
import {transactionsCsv} from './csv';
test('CSV nominal kecil, pemisah, quote, dan formula spreadsheet aman',()=>{
 const csv=transactionsCsv([{id:'1',amount:20000,type:'income',category:'Project',description:' =HYPERLINK("x");test',date:'2026-10-02'}]);
 assert.match(csv,/;20000;/);assert.match(csv,/"' =HYPERLINK\(""x""\);test"/);
 assert.equal(transactionsCsv([]),'\uFEFFTanggal;Jenis;Nominal_Rp;Kategori;Deskripsi\r\n');
});
