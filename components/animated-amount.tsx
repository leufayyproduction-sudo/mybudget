'use client';
import { useEffect, useState } from 'react';
import { rupiah } from '@/lib/finance';
export default function AnimatedAmount({value}:{value:number}){
 const [shown,setShown]=useState(value);
 useEffect(()=>{if(window.matchMedia('(prefers-reduced-motion: reduce)').matches){setShown(value);return;}let frame=0;const start=performance.now();const tick=(now:number)=>{const progress=Math.min(1,(now-start)/350);setShown(Math.round(value*(1-Math.pow(1-progress,3))));if(progress<1)frame=requestAnimationFrame(tick);};frame=requestAnimationFrame(tick);return()=>cancelAnimationFrame(frame);},[value]);
 return <><span aria-hidden="true">{rupiah(shown)}</span><span className="sr-only">{rupiah(value)}</span></>;
}
