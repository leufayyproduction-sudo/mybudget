'use client';
import Link from 'next/link';
import {MessageCircle} from 'lucide-react';
import {useSupport} from './support-provider';
import {whatsappLink} from '@/lib/support';
export default function SupportLink({order,floating=false}:{order?:{order_number:string;product_name:string};floating?:boolean}){const config=useSupport();return floating?<Link href="/kontak" className="support-float" aria-label="Buka bantuan My Budget"><MessageCircle size={20}/><span>Bantuan</span></Link>:<div className="support-links"><Link href="/kontak">Bantuan</Link>{order&&<a href={whatsappLink(config,order)} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">Bantuan pesanan via WhatsApp</a>}</div>;}
