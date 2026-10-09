import {test} from 'node:test';
import assert from 'node:assert/strict';
import {reviewSchema} from '../lib/reviews';
import {productSchema} from '../lib/product-validation';
test('review requires integer stars, plain text and bounded display name/comment',()=>{
 const v={display_name:'Ak***a',rating:5,body:'Membantu mencatat pemasukan.'};
 assert.ok(reviewSchema.safeParse(v).success);
 for(const rating of [0,6,1.5])assert.equal(reviewSchema.safeParse({...v,rating}).success,false);
 for(const body of ['singkat','x'.repeat(501),'<script>alert(1)</script>'])assert.equal(reviewSchema.safeParse({...v,body}).success,false);
 assert.equal(reviewSchema.safeParse({...v,display_name:'<img>'}).success,false);
 assert.equal('status' in reviewSchema.parse({...v,status:'approved',user_id:'other'}),false);
});
test('product catalog rejects zero price while Free remains a non-purchased account state',()=>{
 const p={code:'plus-30',name:'Plus',type:'subscription',price_rupiah:9900,duration_days:30,plan:'plus',active:true,sort_order:0,description:'Plus',promo_starts_at:null,promo_ends_at:null,digital_file_path:null};
 assert.ok(productSchema.safeParse(p).success);
 for(const price_rupiah of [0,-1])assert.equal(productSchema.safeParse({...p,price_rupiah}).success,false);
});
