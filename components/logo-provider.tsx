'use client';
import {createContext,useContext} from 'react';
const LogoContext=createContext<string|null>('/brand/mybudget-logo.png');
export const useLogo=()=>useContext(LogoContext);
export default function LogoProvider({src,children}:{src:string|null;children:React.ReactNode}){return <LogoContext.Provider value={src}>{children}</LogoContext.Provider>;}
