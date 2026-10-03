'use client';
import {createContext,useContext,type ReactNode} from 'react';
import {defaultSupport,type Support} from '@/lib/support';
const Context=createContext<Support>(defaultSupport);
export default function SupportProvider({config,children}:{config:Support;children:ReactNode}){return <Context.Provider value={config}>{children}</Context.Provider>;}
export const useSupport=()=>useContext(Context);
