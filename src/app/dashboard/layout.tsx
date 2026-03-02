'use client';

import { Sidebar } from '@/components/layout/Sidebar';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(true);
    const [isAuthenticated, setIsAuthenticated] = useState(false);

    useEffect(() => {
        const checkAuth = () => {
            const auth = localStorage.getItem('auth');
            if (!auth) {
                router.push('/login');
                setIsAuthenticated(false);
            } else {
                setIsAuthenticated(true);
            }
            setIsLoading(false);
        };

        checkAuth();

        // Add event listener to handle manual localStorage deletions from other tabs
        const handleStorageChange = () => {
            const auth = localStorage.getItem('auth');
            if (!auth) {
                router.push('/login');
                setIsAuthenticated(false);
            } else {
                setIsAuthenticated(true);
            }
        };

        window.addEventListener('storage', handleStorageChange);
        window.addEventListener('authChange', handleStorageChange);

        return () => {
            window.removeEventListener('storage', handleStorageChange);
            window.removeEventListener('authChange', handleStorageChange);
        };
    }, [router]);

    if (isLoading || !isAuthenticated) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="flex flex-col items-center gap-6">
                    <div className="relative">
                        <div className="w-16 h-16 border-2 border-primary/20 rounded-full"></div>
                        <div className="absolute top-0 left-0 w-16 h-16 border-t-2 border-primary rounded-full animate-spin"></div>
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
                        </div>
                    </div>
                    <div className="flex flex-col items-center gap-2">
                        <p className="text-primary font-mono text-[10px] tracking-[0.3em] uppercase animate-pulse">
                            Verifying Credentials
                        </p>
                        <div className="h-1 w-32 bg-white/5 rounded-full overflow-hidden">
                            <div className="h-full bg-primary animate-progress shadow-[0_0_10px_var(--primary)]"></div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background">
            <Sidebar />
            <main className="pl-64 min-h-screen transition-all duration-300">
                <div className="container mx-auto p-4 md:p-8 pt-8">
                    {children}
                </div>
            </main>
        </div>
    );
}
