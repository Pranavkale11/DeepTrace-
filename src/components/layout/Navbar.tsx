'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldAlert, Menu, X, Radio, LogOut, User } from 'lucide-react';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { ThemeToggle } from '@/components/layout/ThemeToggle';

export function Navbar() {
    const pathname = usePathname();
    const router = useRouter();
    const [isOpen, setIsOpen] = useState(false);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [userEmail, setUserEmail] = useState<string | null>(null);

    const checkAuth = () => {
        const auth = localStorage.getItem('auth');
        const email = localStorage.getItem('user');
        setIsAuthenticated(auth === 'true');
        setUserEmail(email);
    };

    useEffect(() => {
        checkAuth();

        // Listen for storage changes (for multiple tabs)
        window.addEventListener('storage', checkAuth);
        // Custom event for same-tab updates
        window.addEventListener('authChange', checkAuth);

        return () => {
            window.removeEventListener('storage', checkAuth);
            window.removeEventListener('authChange', checkAuth);
        };
    }, []);

    const handleLogout = () => {
        localStorage.removeItem('auth');
        localStorage.removeItem('user');
        setIsAuthenticated(false);
        setUserEmail(null);
        window.dispatchEvent(new Event('authChange'));
        router.push('/');
    };

    const publicLinks = [
        { href: '/', label: 'Home' },
        { href: '/login', label: 'Explorer' },
        { href: '/partners', label: 'Partners' },
    ];

    const authLinks = [
        { href: '/', label: 'Home' },
        { href: '/dashboard', label: 'Dashboard' },
        { href: '/dashboard/campaigns', label: 'Explorer' },
        { href: '/partners', label: 'Partners' },
    ];

    const links = isAuthenticated ? authLinks : publicLinks;

    return (
        <header className="fixed top-0 w-full z-40 border-b border-border glass transition-colors duration-300">
            <div className="max-w-[1440px] mx-auto px-6 h-16 flex items-center justify-between">
                {/* Logo */}
                <Link href="/" className="flex items-center gap-2 group">
                    <div className="relative flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-all border border-primary/30 group-hover:border-primary/60">
                        <Radio className="w-4 h-4 text-primary animate-pulse" />
                    </div>
                    <span className="text-xl font-bold tracking-tight text-foreground">
                        DEEP<span className="text-primary italic">TRACE</span>
                    </span>
                </Link>

                {/* Desktop Nav */}
                <nav className="hidden lg:flex items-center gap-10">
                    {links.map((link) => (
                        <Link
                            key={link.href + link.label}
                            href={link.href}
                            className={cn(
                                'text-[10px] font-bold uppercase tracking-[0.2em] transition-all hover:text-primary relative py-1',
                                pathname === link.href ? 'text-primary' : 'text-text-muted'
                            )}
                        >
                            {link.label}
                            {pathname === link.href && (
                                <motion.div
                                    layoutId="navbar-active"
                                    className="absolute -bottom-1 left-0 right-0 h-0.5 bg-primary rounded-full shadow-[0_0_10px_var(--primary)]"
                                />
                            )}
                        </Link>
                    ))}
                </nav>

                {/* Auth Buttons */}
                <div className="hidden md:flex items-center gap-4">
                    <ThemeToggle />
                    <div className="h-4 w-px bg-border mx-2" />

                    {!isAuthenticated ? (
                        <Link href="/login">
                            <Button variant="primary" size="sm" className="font-bold tracking-widest text-[10px] shadow-lg shadow-primary/20 px-6">
                                <ShieldAlert className="w-3.5 h-3.5 mr-2" />
                                LOG IN
                            </Button>
                        </Link>
                    ) : (
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-highlight border border-border">
                                <div className="w-4 h-4 rounded-full bg-primary/20 flex items-center justify-center">
                                    <User className="w-2.5 h-2.5 text-primary" />
                                </div>
                                <span className="text-[10px] font-mono text-text-muted truncate max-w-[120px]">{userEmail}</span>
                            </div>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={handleLogout}
                                className="font-bold tracking-widest text-[10px] text-risk-high hover:text-risk-high hover:bg-risk-high/10"
                            >
                                <LogOut className="w-3.5 h-3.5 mr-2" />
                                LOGOUT
                            </Button>
                        </div>
                    )}
                </div>

                {/* Mobile Toggle */}
                <div className="flex items-center gap-4 md:hidden">
                    <ThemeToggle />
                    <button
                        className="p-2 rounded-md hover:bg-surface-highlight text-foreground transition-colors"
                        onClick={() => setIsOpen(!isOpen)}
                    >
                        {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                    </button>
                </div>
            </div>

            {/* Mobile Menu */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="md:hidden glass border-b border-border overflow-hidden"
                    >
                        <div className="p-6 flex flex-col gap-5">
                            {links.map((link) => (
                                <Link
                                    key={link.href + link.label}
                                    href={link.href}
                                    onClick={() => setIsOpen(false)}
                                    className={cn(
                                        'text-xs font-bold uppercase tracking-widest transition-colors',
                                        pathname === link.href ? 'text-primary' : 'text-text-muted'
                                    )}
                                >
                                    {link.label}
                                </Link>
                            ))}
                            <div className="flex flex-col gap-3 pt-6 border-t border-border mt-2">
                                {!isAuthenticated ? (
                                    <Link href="/login" onClick={() => setIsOpen(false)}>
                                        <Button variant="primary" className="w-full justify-center">LOG IN</Button>
                                    </Link>
                                ) : (
                                    <>
                                        <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-surface-highlight border border-border mb-2">
                                            <User className="w-4 h-4 text-primary" />
                                            <span className="text-xs font-mono text-text-muted truncate">{userEmail}</span>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            className="w-full justify-center text-risk-high"
                                            onClick={() => {
                                                handleLogout();
                                                setIsOpen(false);
                                            }}
                                        >
                                            <LogOut className="w-4 h-4 mr-2" />
                                            LOGOUT
                                        </Button>
                                    </>
                                )}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </header>
    );
}
