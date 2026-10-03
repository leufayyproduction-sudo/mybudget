'use client';
import Link from 'next/link';import Landing from './landing';import {type SiteContent,type PublicProduct} from '@/lib/site-content';
export default function SitePreview({content,products}:{content:SiteContent;products:PublicProduct[]}){return <><div className="cms-preview-actions"><Link className="button secondary" href="/admin/content">Kembali ke editor</Link></div><Landing content={content} products={products} start={()=>{}} login={()=>{}} demo={()=>{}} preview/></>;}
