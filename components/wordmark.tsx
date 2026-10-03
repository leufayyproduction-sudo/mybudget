'use client';
import Image from 'next/image';
import {useLogo} from './logo-provider';
export default function Wordmark(){const src=useLogo();return <span className="wordmark">{src?<Image unoptimized className="official-logo" src={src} alt="My Budget" width={666} height={442} priority/>:'My Budget'}</span>;}
