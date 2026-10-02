import test from 'node:test';
import assert from 'node:assert/strict';
import {reviewSchema,orderFilterSchema} from '../lib/admin-validation';
test('penolakan wajib catatan dan browser tidak dapat menentukan entitlement',()=>{const base={order_id:'12345678-1234-4234-8234-123456789012',decision:'rejected',note:' '};assert.equal(reviewSchema.safeParse(base).success,false);const parsed=reviewSchema.parse({...base,decision:'paid',plan:'pro',price:1});assert.equal('plan' in parsed,false);assert.equal(reviewSchema.safeParse({...base,note:'Referensi tidak cocok'}).success,true);});
test('filter tanggal, UUID, status dan offset admin tervalidasi',()=>{assert.equal(orderFilterSchema.safeParse({from:'2026-02-01',to:'2026-01-01'}).success,false);assert.equal(orderFilterSchema.safeParse({status:'unknown'}).success,false);assert.equal(orderFilterSchema.safeParse({offset:-1}).success,false);assert.equal(orderFilterSchema.safeParse({}).success,true);});
