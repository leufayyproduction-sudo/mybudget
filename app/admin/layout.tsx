import type {ReactNode} from 'react';
import AdminLogout from '@/components/admin-logout';
export default function Layout({children}:{children:ReactNode}){return <><AdminLogout/>{children}</>;}
