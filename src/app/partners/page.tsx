'use client';

import { Navbar } from '@/components/layout/Navbar';
import { motion } from 'framer-motion';
import { Handshake, Globe, Shield, Zap } from 'lucide-react';

export default function PartnersPage() {
    return (
        <main className="min-h-screen bg-background text-foreground">
            <Navbar />

            <section className="relative pt-32 pb-20 overflow-hidden">
                {/* Background Decor */}
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,_rgba(0,255,65,0.05),_transparent_50%)]"></div>

                <div className="container mx-auto px-6 relative z-10">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-center max-w-3xl mx-auto mb-20"
                    >
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/30 bg-primary/10 text-primary text-[10px] font-mono mb-6 tracking-widest uppercase">
                            Global Alliance Program
                        </div>
                        <h1 className="text-4xl md:text-6xl font-bold tracking-tighter mb-6 text-white text-glow">
                            Strategic Intelligence <span className="text-primary">Partners</span>
                        </h1>
                        <p className="text-lg text-text-muted leading-relaxed font-light">
                            DeepTrace collaborates with top-tier cybersecurity firms and international intelligence agencies to maintain the world's most comprehensive database of coordinated influence campaigns.
                        </p>
                    </motion.div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {[
                            {
                                icon: Globe,
                                name: "InterNode Network",
                                category: "Data Provider",
                                desc: "Supplying real-time behavioral metadata across 40+ social platforms."
                            },
                            {
                                icon: Shield,
                                name: "CySentinel",
                                category: "Security Audit",
                                desc: "Independent verification of our coordinated detection algorithms."
                            },
                            {
                                icon: Zap,
                                name: "NeuralShift",
                                category: "AI Research",
                                desc: "Collaborative development on next-gen NLP for disinformation analysis."
                            },
                            {
                                icon: Handshake,
                                name: "Global Watch",
                                category: "NGO Partner",
                                desc: "Applying DeepTrace intelligence to protect electoral integrity worldwide."
                            }
                        ].map((partner, i) => (
                            <motion.div
                                key={partner.name}
                                initial={{ opacity: 0, y: 30 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.1 }}
                                className="glass-card p-8 rounded-xl border border-white/5 hover:border-primary/50 transition-all group"
                            >
                                <div className="w-12 h-12 rounded-lg bg-white/5 flex items-center justify-center mb-6 group-hover:bg-primary/10 transition-colors">
                                    <partner.icon className="w-6 h-6 text-primary" />
                                </div>
                                <span className="text-[10px] font-mono text-primary uppercase tracking-widest mb-2 block">{partner.category}</span>
                                <h3 className="text-xl font-bold text-white mb-3 group-hover:text-primary transition-colors">{partner.name}</h3>
                                <p className="text-sm text-text-muted leading-relaxed">{partner.desc}</p>
                            </motion.div>
                        ))}
                    </div>

                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.6 }}
                        className="mt-20 p-8 rounded-2xl border border-primary/20 bg-primary/5 text-center max-w-2xl mx-auto"
                    >
                        <h4 className="text-white font-bold mb-2">Interested in a Strategic Partnership?</h4>
                        <p className="text-sm text-text-muted mb-6">Join our network of elite intelligence providers and contribute to global platform integrity.</p>
                        <button className="px-6 py-2.5 bg-primary text-black font-bold text-xs rounded hover:bg-primary-dim transition-colors tracking-widest">
                            REQUEST CLEARANCE
                        </button>
                    </motion.div>
                </div>
            </section>

            <footer className="py-8 text-center text-gray-600 text-sm border-t border-white/5 bg-black/50 backdrop-blur-sm">
                <p>© 2026 INNOVIT. DeepTrace Intelligence Systems. All rights reserved.</p>
            </footer >
        </main>
    );
}
