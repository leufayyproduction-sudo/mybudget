import { existsSync, writeFileSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

// Never print credentials, tokens, private records, or raw HTTP/database errors.
if (existsSync('.env.local')) loadEnvFile('.env.local');
if (existsSync('.env.rls-test')) loadEnvFile('.env.rls-test');
const result = { checked_at: new Date().toISOString(), status: 'blocked', checks: [], cleanup: 'not_needed' };
const check = (label, ok) => { result.checks.push({ label, passed: ok }); if (!ok) { result.status='failed'; throw new Error(label); } console.log(`PASS ${label}`); };
const fail = (label) => { throw new Error(label); };
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const fixtures = [];
const clients = [];
const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(15000) }) } };
function publicKeyOnly(value) {
 if (value.startsWith('sb_secret_')) return false;
 if (!value.includes('.')) return value.startsWith('sb_publishable_');
 try { return JSON.parse(Buffer.from(value.split('.')[1], 'base64url').toString()).role === 'anon'; } catch { return false; }
}
async function ownRow(client, table, row) {
 const r = await client.from(table).insert(row).select('*').single();
 if (r.error) fail(`Fixture ${table} tidak dapat dibuat; periksa migration/constraint/akun uji.`);
 fixtures.push({ client, table, column: table === 'profiles' ? 'user_id' : 'id', id: table === 'profiles' ? row.user_id : row.id });
 check(`${table}: pemilik dapat membuat dan membaca fixture`, !!r.data);
 return r.data;
}
async function inaccessible(attacker, owner, table, row) {
 const column = table === 'profiles' ? 'user_id' : 'id';
 const id = row[column];
 const read = await attacker.from(table).select('*').eq(column, id);
 check(`${table}: akun lain tidak dapat membaca`, !read.error && read.data.length === 0);
 const patch = table === 'categories' ? { name: row.name } : { data: row.data };
 const update = await attacker.from(table).update(patch).eq(column, id).select(column);
 check(`${table}: akun lain tidak dapat mengubah`, !update.error && update.data.length === 0);
 const remove = await attacker.from(table).delete().eq(column, id).select(column);
 check(`${table}: akun lain tidak dapat menghapus`, !remove.error && remove.data.length === 0);
 const preserved = await owner.from(table).select('*').eq(column, id).single();
 check(`${table}: fixture tetap utuh setelah percobaan lintas akun`, !preserved.error && JSON.stringify(preserved.data) === JSON.stringify(row));
 const forged = { ...row, ...(table !== 'profiles' ? { id: randomUUID() } : {}) };
 const insert = await attacker.from(table).insert(forged);
 check(`${table}: insert dengan user_id akun lain ditolak oleh RLS`, insert.error?.code === '42501');
}
try {
 if (!url || !key) fail('Environment Supabase belum lengkap.');
 if (!publicKeyOnly(key)) fail('Gunakan anon/publishable key; secret/service_role tidak diizinkan.');
 const settings = await fetch(`${url.replace(/\/$/, '')}/auth/v1/settings`, { headers: { apikey: key }, signal: AbortSignal.timeout(15000) });
 check('Supabase Auth sungguhan dapat dijangkau dengan public key', settings.ok);
 const anonymous = createClient(url, key, options);
 for (const table of ['profiles', 'categories', 'transactions', 'budgets', 'goals']) {
  const r = await anonymous.from(table).select(table === 'profiles' ? 'user_id' : 'id').limit(1);
  if (['PGRST205', '42P01'].includes(r.error?.code)) fail(`Tabel ${table} belum tersedia; jalankan migration 001.`);
  check(`${table}: akses anonim dibatasi`, r.error?.code === '42501' || (!r.error && r.data.length === 0));
 }
 const required = ['RLS_TEST_A_EMAIL', 'RLS_TEST_A_PASSWORD', 'RLS_TEST_B_EMAIL', 'RLS_TEST_B_PASSWORD'];
 const missing = required.filter(name => !process.env[name]);
 if (missing.length) fail(`Isi variabel lokal: ${missing.join(', ')}.`);
 if (process.env.RLS_TEST_ALLOW_FIXTURES !== 'dedicated-test-accounts') fail('Isi RLS_TEST_ALLOW_FIXTURES=dedicated-test-accounts hanya untuk dua akun uji tanpa onboarding.');
 for (const letter of ['A', 'B']) {
  const client = createClient(url, key, options);
  clients.push(client);
  const signed = await client.auth.signInWithPassword({ email: process.env[`RLS_TEST_${letter}_EMAIL`], password: process.env[`RLS_TEST_${letter}_PASSWORD`] });
  if (signed.error || !signed.data.user) fail(`Login akun uji ${letter} gagal; periksa kredensial dan konfirmasi email.`);
  client.testUserId = signed.data.user.id;
 }
 check('A dan B adalah dua pengguna berbeda', clients[0].testUserId !== clients[1].testUserId);
 // Refuse to mutate existing profiles: use freshly registered test accounts without onboarding.
 for (const client of clients) {
  const p = await client.from('profiles').select('user_id').eq('user_id', client.testUserId);
  if (p.error || p.data.length) fail('Akun uji harus belum punya profile. Gunakan dua akun uji baru tanpa onboarding.');
 }
 const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date()).filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));
 const date = `${parts.year}-${parts.month}-${parts.day}`;
 const run = randomUUID().slice(0, 8);
 const records = [];
 for (const client of clients) {
  const user_id = client.testUserId;
  const profile = await ownRow(client, 'profiles', { user_id, data: { name: `RLS test ${run}`, pattern: 'Freelance/tidak tetap', purpose: 'Mengatur pengeluaran', fixed: 0, project: 20000, projects: 1, opening: 0 } });
  const category = await ownRow(client, 'categories', { id: randomUUID(), user_id, name: `RLS test ${run}` });
  const transaction = await ownRow(client, 'transactions', { id: randomUUID(), user_id, category_id: category.id, data: { amount: 20000, type: 'income', category: 'Project', description: `RLS test ${run}`, date } });
  const budget = await ownRow(client, 'budgets', { id: randomUUID(), user_id, category_id: category.id, data: { amount: 20000, category: 'Makan & minum', month: date.slice(0,7), mandatory: true } });
  const goal = await ownRow(client, 'goals', { id: randomUUID(), user_id, data: { name: `RLS test ${run}`, target: 20000, saved: 0, monthly: 0 } });
  records.push({ profiles: profile, categories: category, transactions: transaction, budgets: budget, goals: goal });
 }
 for (const [a,b] of [[0,1],[1,0]]) {
  for (const table of ['profiles','categories','transactions','budgets','goals']) await inaccessible(clients[a], clients[b], table, records[b][table]);
  for (const table of ['transactions','budgets']) {
   const attempted = { ...records[a][table], category_id: records[b].categories.id };
   const cross = await clients[a].from(table).update({ category_id: attempted.category_id }).eq('id', attempted.id);
   check(`${table}: kategori milik akun lain ditolak composite FK`, cross.error?.code === '23503');
  }
 }
 for (const patch of [{ amount: 0 }, { amount: -1 }, { amount: 1.5 }, { amount: null }, { date: '2999-01-01' }, { date: '2026-02-30' }]) {
  const validation = await clients[0].from('transactions').update({ data: { ...records[0].transactions.data, ...patch } }).eq('id', records[0].transactions.id);
  check(`Validasi database menolak ${Object.keys(patch)[0]} tidak valid`, ['23514','P0001','22008'].includes(validation.error?.code));
 }
 result.status = 'passed';
} catch (e) {
 const message = e.message;
 // Only our own messages are allowed in logs; network exception details may include URLs.
 const safe = message.includes('fetch') || e.name === 'TimeoutError' || e.name === 'AbortError' ? 'Koneksi jaringan/timeout; verifikasi belum selesai.' : message;
 result.reason = safe;
 console.log(`VERIFICATION ${result.status.toUpperCase()}: ${safe}`);
 process.exitCode = 2;
} finally {
 let cleanupOk = true;
 for (const fixture of fixtures.reverse()) {
  try { const r = await fixture.client.from(fixture.table).delete().eq(fixture.column, fixture.id); if (r.error) cleanupOk = false; } catch { cleanupOk = false; }
 }
 if (fixtures.length) result.cleanup = cleanupOk ? 'passed' : 'needs_attention';
 if (!cleanupOk) { result.status = 'blocked'; result.reason = 'Cleanup fixture belum lengkap; jalankan ulang setelah koneksi tersedia.'; process.exitCode = 2; }
 for (const client of clients) await client.auth.signOut({ scope: 'local' });
 // Safe report contains labels/counts only, never credentials or user/row IDs.
 writeFileSync('docs/phase1-rls-result.json', JSON.stringify(result,null,2)+'\n');
 console.log(`Hasil: ${result.status}; cleanup: ${result.cleanup}. Laporan: docs/phase1-rls-result.json`);
}
