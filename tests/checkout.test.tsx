import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createOrderSchema,confirmationSchema,validateProof,orderStatus} from '../lib/checkout';
test('harga/plan/pemilik dari browser dibuang sebelum RPC',()=>{
 const data=createOrderSchema.parse({product_code:'plus-30',request_id:'7ec4a3d2-5295-4e6b-a51a-73f2490618c2',price_rupiah:1,plan:'pro',user_id:'other'});
 assert.deepEqual(Object.keys(data),['product_code','request_id']);
});
test('konfirmasi wajib referensi dan label tidak mengklaim pembayaran diterima',()=>{
 assert.equal(confirmationSchema.safeParse({reference:'  '}).success,false);
 assert.equal(confirmationSchema.safeParse({reference:'abc',note:'x'.repeat(1001)}).success,false);
 assert.equal(confirmationSchema.parse({reference:' ref-123 '}).reference,'ref-123');
 assert.equal(orderStatus.submitted,'Menunggu verifikasi admin');
 assert.notEqual(orderStatus.submitted,orderStatus.paid);
});
test('bukti hanya gambar sampai 5 MB, bukan SVG/HTML/file kosong',()=>{
 assert.equal(validateProof({size:5*1024*1024,type:'image/png'}),null);
 for(const file of [{size:1,type:'image/svg+xml'},{size:1,type:'text/html'},{size:0,type:'image/jpeg'},{size:5*1024*1024+1,type:'image/webp'}])assert.ok(validateProof(file));
});
