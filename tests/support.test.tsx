import {test} from 'node:test';
import assert from 'node:assert/strict';
import {defaultSupport,supportSchema,whatsappLink} from '../lib/support';
test('WhatsApp phone validation accepts Indonesia E164 digits only',()=>{
 assert.ok(supportSchema.safeParse(defaultSupport).success);
 for(const phone of ['+6288806001355','088806001355','62 88806001355','62888-0600-1355','621','62012345678','https://bad.test','628880600135500000'])assert.equal(supportSchema.safeParse({...defaultSupport,phone}).success,false);
 assert.equal(supportSchema.safeParse({...defaultSupport,message:''}).success,false);assert.equal(supportSchema.safeParse({...defaultSupport,hours:'x'.repeat(121)}).success,false);
});
test('WhatsApp link safely encodes initial message and includes only order id/product',()=>{
 const config={...defaultSupport,message:'Halo & bantuan?\nTerima kasih'};
 const url=new URL(whatsappLink(config,{order_number:'MB-TEST',product_name:'Plus & Pro'}));assert.equal(url.origin,'https://wa.me');assert.equal(url.pathname,'/6288806001355');assert.equal(url.searchParams.get('text'),'Halo & bantuan?\nTerima kasih\nID pesanan: MB-TEST\nProduk: Plus & Pro');
 const extra={order_number:'MB-TEST',product_name:'Plus',email:'secret@example.test',total_rupiah:9900};assert.ok(!whatsappLink(config,extra).includes('secret'));assert.ok(!whatsappLink(config,extra).includes('9900'));
 assert.equal(new URL(whatsappLink(defaultSupport)).searchParams.get('text'),defaultSupport.message);
});
