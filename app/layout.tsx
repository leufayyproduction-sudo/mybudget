import './globals.css';
import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/latin-500.css';
import '@fontsource/inter/latin-600.css';
import '@fontsource/inter/latin-700.css';
import type { Metadata } from 'next';
import LogoProvider from '@/components/logo-provider';
import {getPublicSite} from '@/lib/site-server';
import {logoUrl} from '@/lib/site-content';
export const metadata: Metadata = { title: 'My Budget — Pahami uangmu', description: 'Keuangan personal untuk pemasukan tetap dan freelance.' };
export default async function Layout({ children }: { children: React.ReactNode }) {const {content}=await getPublicSite();return <html lang="id"><body><LogoProvider src={logoUrl(content.logo_path)}>{children}</LogoProvider></body></html>; }
