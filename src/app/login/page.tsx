'use client';

import { ShieldAlert, Lock, User, Key, ScanLine, ArrowLeft, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [email, setEmail] = useState('admin@deeptrace.ai');
    const [password, setPassword] = useState('password');
    const [error, setError] = useState<string | null>(null);

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!email || !password) {
            setError("Identification credentials cannot be empty.");
            return;
        }

        setIsLoading(true);

        // Mimic API delay
        setTimeout(() => {
            localStorage.setItem("auth", "true");
            localStorage.setItem("user", email);
            window.dispatchEvent(new Event('authChange'));
            router.push('/dashboard');
        }, 1500);
    };

    return (
        <div className="min-h-screen grid grid-cols-1 md:grid-cols-2 bg-background text-foreground">
            {/* Left Panel - Visual */}
            <div className="hidden md:flex flex-col items-center justify-center bg-black border-r border-white/10 relative overflow-hidden p-10">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/10 via-black to-black opacity-40"></div>
                <div className="z-10 text-center">
                    <Link href="/" className="inline-block mb-10 group">
                        <div className="w-24 h-24 bg-primary/10 rounded-2xl flex items-center justify-center border border-primary/50 mx-auto group-hover:bg-primary/20 transition-all duration-500 shadow-[0_0_30px_rgba(0,255,65,0.2)]">
                            <ShieldAlert className="w-12 h-12 text-primary group-hover:scale-110 transition-transform" />
                        </div>
                    </Link>
                    <h2 className="text-5xl font-bold text-white mb-6 tracking-tighter text-glow">DEEP<span className="text-primary neon-text-green">TRACE</span></h2>
                    <p className="text-gray-400 max-w-md mx-auto text-lg leading-relaxed">
                        Authorized Personnel Only.<br />
                        All actions are monitored and recorded on the immutable ledger.
                    </p>
                </div>

                {/* Animated Lines */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-20">
                    <div className="absolute top-1/2 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-primary to-transparent animate-pulse delay-75"></div>
                    <div className="absolute top-1/3 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-primary to-transparent animate-pulse delay-500"></div>
                </div>
            </div>

            {/* Right Panel - Form */}
            <div className="flex items-center justify-center bg-background p-8 relative">
                <Link href="/" className="absolute top-8 left-8 text-gray-500 hover:text-white flex items-center gap-2 transition-colors">
                    <ArrowLeft className="w-4 h-4" /> Back to Home
                </Link>

                <div className="w-full max-w-md space-y-10 relative z-10 animate-in fade-in slide-in-from-right duration-700">
                    <div className="text-center md:text-left">
                        <h2 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
                            <Lock className="w-6 h-6 text-primary" />
                            Identify Yourself
                        </h2>
                        <p className="text-gray-400">Enter your secure credentials to access the intelligence dashboard.</p>
                    </div>

                    {error && (
                        <div className="bg-risk-high/10 border border-risk-high/30 p-4 rounded-lg flex items-center gap-3 text-risk-high text-sm animate-in fade-in zoom-in duration-300">
                            <AlertCircle className="w-5 h-5 flex-shrink-0" />
                            <p>{error}</p>
                        </div>
                    )}

                    <form onSubmit={handleLogin} className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-xs font-mono text-gray-500 uppercase tracking-wider">Agency ID / Email</label>
                            <div className="relative group">
                                <User className="absolute left-3 top-3 w-5 h-5 text-gray-500 group-focus-within:text-primary transition-colors" />
                                <input
                                    type="email"
                                    className="w-full bg-black/50 border border-white/10 rounded-lg px-10 py-3 text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all placeholder:text-gray-700"
                                    placeholder="agent@innovit.gov"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-mono text-gray-500 uppercase tracking-wider">Access Key</label>
                            <div className="relative group">
                                <Key className="absolute left-3 top-3 w-5 h-5 text-gray-500 group-focus-within:text-primary transition-colors" />
                                <input
                                    type="password"
                                    className="w-full bg-black/50 border border-white/10 rounded-lg px-10 py-3 text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all placeholder:text-gray-700"
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                />
                            </div>
                        </div>

                        <Button variant="primary" className="w-full py-6 text-lg group relative overflow-hidden shadow-[0_0_20px_rgba(0,255,65,0.1)] hover:shadow-[0_0_30px_rgba(0,255,65,0.2)]" isLoading={isLoading}>
                            <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000 transform skew-x-12"></div>
                            <Lock className="w-5 h-5 mr-3 group-hover:hidden" />
                            <ScanLine className="w-5 h-5 mr-3 hidden group-hover:block animate-pulse" />
                            {isLoading ? 'Authenticating...' : 'Secure Login'}
                        </Button>
                    </form>

                    <div className="text-center text-xs text-gray-600 mt-6 pt-6 border-t border-white/5">
                        <p className="mb-4 text-gray-400">No Clearance? <Link href="/signup" className="text-primary hover:underline">Apply for Access</Link></p>
                        <div className="flex items-center justify-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
                            <span className="font-mono text-[10px] tracking-widest">SERVER STATUS: <span className="text-green-500">OPERATIONAL</span></span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
