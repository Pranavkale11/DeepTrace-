'use client';

import { motion } from 'framer-motion';
import { Button } from '@/components/ui/Button';
import { Network, Shield, Eye, Activity, Lock } from 'lucide-react';
import Link from 'next/link';

export function Hero() {
    return (
        <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-20 pb-20">
            {/* Background Elements */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/5 via-background to-background"></div>

            {/* Animated Orbs */}
            <motion.div
                animate={{
                    scale: [1, 1.2, 1],
                    opacity: [0.3, 0.5, 0.3],
                }}
                transition={{ duration: 4, repeat: Infinity }}
                className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-[120px]"
            />
            <motion.div
                animate={{
                    scale: [1, 1.1, 1],
                    opacity: [0.2, 0.4, 0.2],
                }}
                transition={{ duration: 5, repeat: Infinity, delay: 1 }}
                className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-secondary/20 rounded-full blur-[120px]"
            />

            {/* Grid Overlay */}
            <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:50px_50px] [mask-image:radial-gradient(ellipse_at_center,black_70%,transparent_100%)] pointer-events-none"></div>

            <div className="container mx-auto px-4 relative z-10 text-center">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8 }}
                >
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/30 bg-primary/10 text-primary text-xs font-mono mb-8 backdrop-blur-sm">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                        </span>
                        SYSTEM OPERATIONAL // V.2.0.4
                    </div>

                    <h1 className="text-5xl md:text-8xl font-bold tracking-tighter mb-6 text-white text-glow">
                        DEEP<span className="text-primary neon-text-green">TRACE</span>
                    </h1>

                    <p className="text-xl md:text-2xl text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed font-light">
                        AI System for Detecting <span className="text-white font-medium">Coordinated Influence Campaigns</span> and Disinformation Networks.
                    </p>

                    <div className="flex flex-col md:flex-row items-center justify-center gap-6">
                        <Link href="/login">
                            <Button size="lg" variant="primary" className="min-w-[200px] h-14 text-lg">
                                <Shield className="w-5 h-5 mr-2" />
                                Initialize System
                            </Button>
                        </Link>
                        <Link href="/login">
                            <Button size="lg" variant="outline" className="min-w-[200px] h-14 text-lg">
                                <Activity className="w-5 h-5 mr-2" />
                                Live Demo Mode
                            </Button>
                        </Link>
                    </div>
                </motion.div>

                {/* Feature Cards Preview */}
                <motion.div
                    initial={{ opacity: 0, y: 40 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, delay: 0.4 }}
                    className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-24 max-w-6xl mx-auto"
                >
                    {[
                        { icon: Network, title: "Bot Network Detection", color: "text-primary", desc: "Identifies clusters of coordinated bot activity using graph theory." },
                        { icon: Eye, title: "Real-time Surveillance", color: "text-secondary", desc: "Monitors cross-platform social activity with millisecond latency." },
                        { icon: Lock, title: "Threat Mitigation", color: "text-accent", desc: "Automated response protocols for high-risk disinformation campaigns." },
                    ].map((feature, i) => (
                        <div key={i} className="glass-card p-8 rounded-xl border border-white/5 hover:border-primary/50 transition-all duration-300 group hover:-translate-y-2 text-left">
                            <div className={`p-3 rounded-lg bg-white/5 w-fit mb-6 group-hover:bg-white/10 transition-colors`}>
                                <feature.icon className={`w-8 h-8 ${feature.color}`} />
                            </div>
                            <h3 className="text-xl font-bold text-white mb-3 tracking-wide">{feature.title}</h3>
                            <p className="text-sm text-gray-400 leading-relaxed">{feature.desc}</p>
                        </div>
                    ))}
                </motion.div>
            </div>
        </section>
    );
}
