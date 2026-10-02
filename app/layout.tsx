import './globals.css';
import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'My Budget — Pahami uangmu', description: 'Keuangan personal untuk pemasukan tetap dan freelance.' };
export default function Layout({ children }: { children: React.ReactNode }) { return <html lang="id"><body>{children}</body></html>; }
