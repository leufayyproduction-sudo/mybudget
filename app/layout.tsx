import './globals.css';
import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/latin-500.css';
import '@fontsource/inter/latin-600.css';
import '@fontsource/inter/latin-700.css';
import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'My Budget — Pahami uangmu', description: 'Keuangan personal untuk pemasukan tetap dan freelance.' };
export default function Layout({ children }: { children: React.ReactNode }) { return <html lang="id"><body>{children}</body></html>; }
