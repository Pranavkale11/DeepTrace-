'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Shield, ShieldAlert, ShieldCheck, Activity, Users, Clock, FileText, Youtube } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { cn } from '@/lib/utils';
import type { LiveScanResult } from './LiveScanPanel';

interface LiveResultCardProps {
    result: LiveScanResult;
}

/* --------------- Animated Counter --------------- */
function AnimatedNumber({ value, decimals = 0, suffix = '' }: { value: number; decimals?: number; suffix?: string }) {
    const [display, setDisplay] = useState(0);
    const rafRef = useRef<number>(0);

    useEffect(() => {
        const start = 0;
        const end = value;
        const duration = 1600;
        const startTime = performance.now();

        const step = (now: number) => {
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);
            // easeOutCubic
            const eased = 1 - Math.pow(1 - progress, 3);
            setDisplay(start + (end - start) * eased);
            if (progress < 1) {
                rafRef.current = requestAnimationFrame(step);
            }
        };

        rafRef.current = requestAnimationFrame(step);
        return () => cancelAnimationFrame(rafRef.current);
    }, [value]);

    return (
        <span>
            {display.toFixed(decimals)}
            {suffix}
        </span>
    );
}

/* --------------- Signal Bar --------------- */
function SignalBar({ label, value, color }: { label: string; value: number; color: string }) {
    const pct = Math.round(value * 100);
    return (
        <div className="space-y-1.5">
            <div className="flex justify-between items-center">
                <span className="text-[11px] text-text-muted font-mono">{label}</span>
                <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 }}
                    className="text-[11px] font-bold font-mono"
                    style={{ color }}
                >
                    <AnimatedNumber value={pct} suffix="%" />
                </motion.span>
            </div>
            <div className="h-1.5 bg-surface-highlight rounded-full overflow-hidden">
                <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 1.2, ease: [0.4, 0, 0.2, 1], delay: 0.3 }}
                    className="h-full rounded-full"
                    style={{
                        background: color,
                        boxShadow: `0 0 8px ${color}60`,
                    }}
                />
            </div>
        </div>
    );
}

/* --------------- Main Component --------------- */
export function LiveResultCard({ result }: LiveResultCardProps) {
    const riskScore = Math.round(result.risk_score * 100);
    const riskLevel = result.risk_level;

    const riskConfig = {
        high: {
            color: 'var(--risk-high)',
            colorClass: 'text-risk-high',
            borderClass: 'border-risk-high/30',
            bgClass: 'bg-risk-high/5',
            glowStyle: '0 0 40px rgba(255, 0, 60, 0.15)',
            Icon: ShieldAlert,
            label: 'HIGH RISK',
            topGlow: 'via-risk-high/60',
        },
        medium: {
            color: 'var(--risk-medium)',
            colorClass: 'text-risk-medium',
            borderClass: 'border-risk-medium/30',
            bgClass: 'bg-risk-medium/5',
            glowStyle: '0 0 40px rgba(255, 230, 0, 0.10)',
            Icon: Shield,
            label: 'MEDIUM RISK',
            topGlow: 'via-risk-medium/60',
        },
        low: {
            color: 'var(--risk-low)',
            colorClass: 'text-risk-low',
            borderClass: 'border-risk-low/30',
            bgClass: 'bg-risk-low/5',
            glowStyle: '0 0 40px rgba(0, 255, 65, 0.10)',
            Icon: ShieldCheck,
            label: 'LOW RISK',
            topGlow: 'via-risk-low/60',
        },
    };

    const cfg = riskConfig[riskLevel] || riskConfig.low;
    const { Icon } = cfg;

    return (
        <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.7, ease: [0.4, 0, 0.2, 1] }}
        >
            <Card
                className={cn('relative overflow-hidden', cfg.borderClass, cfg.bgClass)}
                style={{ boxShadow: cfg.glowStyle }}
            >
                {/* Top border glow */}
                <div className={cn('absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent', cfg.topGlow, 'to-transparent')} />

                {/* Live Badge */}
                <div className="absolute top-4 right-4 flex items-center gap-1.5 bg-background/60 border border-border px-2.5 py-1 rounded-sm">
                    <motion.div
                        animate={{ opacity: [1, 0.2, 1] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ background: cfg.color, boxShadow: `0 0 6px ${cfg.color}` }}
                    />
                    <span className="text-[9px] font-mono text-text-muted uppercase tracking-widest">Intelligence Report</span>
                </div>

                <div className="space-y-6">
                    {/* Header Row */}
                    <div className="flex items-start gap-4 pr-36">
                        <div
                            className="p-3 rounded border flex-shrink-0"
                            style={{ background: `${cfg.color}15`, borderColor: `${cfg.color}30` }}
                        >
                            <Icon className="w-6 h-6" style={{ color: cfg.color }} />
                        </div>
                        <div>
                            <div className="flex items-center gap-3 mb-1">
                                <Youtube className="w-4 h-4 text-risk-high/70" />
                                <span className="text-[10px] font-mono text-text-dim uppercase tracking-widest">
                                    Cross-Video Coordination Analysis
                                </span>
                            </div>
                            <h2 className="text-lg font-bold text-foreground tracking-tight">
                                Live YouTube Scan Complete
                            </h2>
                        </div>
                    </div>

                    {/* Risk Score + Level */}
                    <div className="flex items-center gap-6">
                        {/* Giant animated risk number */}
                        <div className="relative flex flex-col items-center justify-center w-28 h-28 flex-shrink-0">
                            {/* Radial progress ring */}
                            <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 100 100">
                                <circle cx="50" cy="50" r="44" fill="none" stroke="var(--surface-highlight)" strokeWidth="6" />
                                <motion.circle
                                    cx="50" cy="50" r="44"
                                    fill="none"
                                    stroke={cfg.color}
                                    strokeWidth="6"
                                    strokeLinecap="round"
                                    strokeDasharray={`${2 * Math.PI * 44}`}
                                    initial={{ strokeDashoffset: `${2 * Math.PI * 44}` }}
                                    animate={{ strokeDashoffset: `${2 * Math.PI * 44 * (1 - result.risk_score)}` }}
                                    transition={{ duration: 1.6, ease: [0.4, 0, 0.2, 1] }}
                                    style={{ filter: `drop-shadow(0 0 6px ${cfg.color})` }}
                                />
                            </svg>
                            <span
                                className="text-3xl font-black font-mono z-10"
                                style={{ color: cfg.color, textShadow: `0 0 20px ${cfg.color}60` }}
                            >
                                <AnimatedNumber value={riskScore} />
                            </span>
                            <span className="text-[9px] font-mono text-text-dim z-10 -mt-1">RISK SCORE</span>
                        </div>

                        <div className="flex flex-col gap-2">
                            <motion.div
                                initial={{ scale: 0.8, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                transition={{ delay: 0.4, type: 'spring', stiffness: 300 }}
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-sm font-black text-sm uppercase tracking-widest border"
                                style={{
                                    color: cfg.color,
                                    borderColor: `${cfg.color}40`,
                                    background: `${cfg.color}10`,
                                    textShadow: `0 0 10px ${cfg.color}40`,
                                }}
                            >
                                <Icon className="w-4 h-4" />
                                {cfg.label}
                            </motion.div>

                            <div className="flex items-center gap-4 text-xs text-text-muted font-mono">
                                <span className="flex items-center gap-1.5">
                                    <Activity className="w-3.5 h-3.5" />
                                    {result.total_videos_scanned} Videos Scanned
                                </span>
                                <span className="flex items-center gap-1.5">
                                    <Users className="w-3.5 h-3.5" />
                                    {result.total_comments_analyzed} Comments
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Signals Section */}
                    <div
                        className="p-4 rounded-sm border space-y-4"
                        style={{
                            background: 'rgba(0,0,0,0.2)',
                            borderColor: 'var(--border)',
                        }}
                    >
                        <div className="flex items-center gap-2 mb-1">
                            <Activity className="w-3.5 h-3.5 text-text-dim" />
                            <span className="text-[10px] font-mono text-text-dim uppercase tracking-widest">
                                Coordination Signal Breakdown
                            </span>
                        </div>
                        <SignalBar
                            label="Cross-Video Narrative Similarity"
                            value={result.signals.cross_video_similarity}
                            color={cfg.color}
                        />
                        <SignalBar
                            label="Account Reuse Across Videos"
                            value={result.signals.account_reuse}
                            color={cfg.color}
                        />
                        <SignalBar
                            label="Temporal Burst Synchronization"
                            value={result.signals.temporal_burst}
                            color={cfg.color}
                        />
                    </div>

                    {/* Stats Row */}
                    <div className="grid grid-cols-2 gap-3">
                        {[
                            { label: 'Total Videos', value: result.total_videos_scanned, Icon: Youtube },
                            { label: 'Comments Analyzed', value: result.total_comments_analyzed, Icon: Users },
                        ].map(({ label, value, Icon: StatIcon }) => (
                            <div
                                key={label}
                                className="flex items-center gap-3 p-3 rounded-sm border"
                                style={{ background: 'rgba(0,0,0,0.15)', borderColor: 'var(--border)' }}
                            >
                                <div className="p-2 bg-surface-highlight rounded-sm border border-border">
                                    <StatIcon className="w-3.5 h-3.5 text-text-muted" />
                                </div>
                                <div>
                                    <p className="text-lg font-black font-mono text-foreground">{value}</p>
                                    <p className="text-[10px] text-text-dim uppercase tracking-widest">{label}</p>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* AI Explanation */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.8 }}
                        className="relative p-4 rounded-sm border overflow-hidden"
                        style={{
                            background: 'rgba(0, 0, 0, 0.25)',
                            borderColor: `${cfg.color}25`,
                        }}
                    >
                        {/* Corner accent */}
                        <div
                            className="absolute top-0 left-0 w-8 h-8 pointer-events-none"
                            style={{
                                background: `linear-gradient(135deg, ${cfg.color}25 0%, transparent 60%)`,
                            }}
                        />

                        <div className="flex items-center gap-2 mb-3">
                            <FileText className="w-3.5 h-3.5" style={{ color: cfg.color }} />
                            <span className="text-[10px] font-mono uppercase tracking-widest" style={{ color: cfg.color }}>
                                AI Intelligence Report
                            </span>
                            <Clock className="w-3 h-3 text-text-dim ml-auto" />
                            <span className="text-[10px] font-mono text-text-dim">
                                {new Date().toLocaleTimeString('en-US', { hour12: false })}
                            </span>
                        </div>

                        <div className="border-l-2 pl-3" style={{ borderColor: `${cfg.color}60` }}>
                            <p className="text-sm text-foreground/90 leading-relaxed font-mono">
                                {result.explanation}
                            </p>
                        </div>
                    </motion.div>
                </div>

                {/* Bottom glow line */}
                <div className={cn('absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent', cfg.topGlow, 'to-transparent')} />
            </Card>
        </motion.div>
    );
}
