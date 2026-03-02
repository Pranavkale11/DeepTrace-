'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import {
    Brain, Send, Trash2, ShieldAlert, Activity, BarChart2,
    AlertTriangle, ChevronDown, ChevronUp, Zap, Share2,
    CheckCircle, XCircle, Loader2, Copy, RotateCcw, Info
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { cn } from '@/lib/utils';
import {
    ResponsiveContainer,
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
    PieChart, Pie, Cell, Legend,
    BarChart, Bar,
} from 'recharts';

// ─── Types ────────────────────────────────────────────────────────────────────
interface NarrativeCluster {
    name: string;
    volume: number;
    sentiment: 'positive' | 'negative' | 'neutral';
    description?: string;
}

interface TimelinePoint {
    date: string;
    mentions: number;
}

interface PlatformPoint {
    platform: string;
    percentage: number;
}

interface AnalysisResult {
    summary: string;
    threat_score: number;
    classification: 'Low' | 'Moderate' | 'High' | 'Critical';
    narrative_clusters: NarrativeCluster[];
    timeline_data: TimelinePoint[];
    platform_distribution: PlatformPoint[];
    risk_factors: string[];
    recommendations: string[];
    surge_alert: boolean;
    coordination_detected: boolean;
    autonomous_flags?: string[];
}

interface ToastEntry {
    id: string;
    type: 'error' | 'success' | 'warning';
    message: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const SCORE_COLOR = (score: number) => {
    if (score <= 30) return { text: 'text-risk-low', bg: 'bg-risk-low/10', border: 'border-risk-low/30', glow: 'shadow-[0_0_20px_rgba(0,255,65,0.3)]', hex: '#00ff41' };
    if (score <= 60) return { text: 'text-risk-medium', bg: 'bg-risk-medium/10', border: 'border-risk-medium/30', glow: 'shadow-[0_0_20px_rgba(255,230,0,0.3)]', hex: '#ffe600' };
    if (score <= 80) return { text: 'text-orange-400', bg: 'bg-orange-400/10', border: 'border-orange-400/30', glow: 'shadow-[0_0_20px_rgba(251,146,60,0.3)]', hex: '#fb923c' };
    return { text: 'text-risk-high', bg: 'bg-risk-high/10', border: 'border-risk-high/30', glow: 'shadow-[0_0_20px_rgba(255,0,60,0.3)]', hex: '#ff003c' };
};

const PIE_COLORS = ['#00ff41', '#00f3ff', '#ffe600', '#ff003c', '#a78bfa', '#f97316'];

const SENTIMENT_COLOR = (s: string) => {
    if (s === 'negative') return 'text-risk-high bg-risk-high/10';
    if (s === 'positive') return 'text-risk-low bg-risk-low/10';
    return 'text-risk-medium bg-risk-medium/10';
};

const SUGGESTED_QUERIES = [
    "Analyze this report: High volume of anti-government sentiment detected across Twitter and Telegram in the past 48 hours. Multiple coordinated accounts sharing identical hashtags.",
    "Deep dive: 3 platforms showing synchronized narrative push about election manipulation. Posts appearing within minutes of each other.",
    "Summary of threat level based on: 15,000 bot accounts detected, 80% centered on a single hashtag, 3 major news media cited.",
    "Generate graph for: Campaign showing exponential growth from 200 to 8,000 mentions over 7 days across Facebook, Twitter, and YouTube.",
];

const itemVariants: Variants = {
    hidden: { opacity: 0, y: 16 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.4, 0, 0.2, 1] } },
};

// ─── Sub-components ──────────────────────────────────────────────────────────

function Toast({ toasts, onDismiss }: { toasts: ToastEntry[]; onDismiss: (id: string) => void }) {
    return (
        <div className="fixed bottom-6 right-6 z-[999] flex flex-col gap-2 pointer-events-none">
            <AnimatePresence>
                {toasts.map(t => (
                    <motion.div
                        key={t.id}
                        initial={{ opacity: 0, x: 60, scale: 0.9 }}
                        animate={{ opacity: 1, x: 0, scale: 1 }}
                        exit={{ opacity: 0, x: 60, scale: 0.9 }}
                        className={cn(
                            "pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-medium shadow-2xl backdrop-blur-xl",
                            t.type === 'error' ? 'bg-risk-high/10 border-risk-high/40 text-risk-high' :
                                t.type === 'warning' ? 'bg-risk-medium/10 border-risk-medium/40 text-risk-medium' :
                                    'bg-risk-low/10 border-risk-low/40 text-risk-low'
                        )}
                    >
                        {t.type === 'error' ? <XCircle className="w-4 h-4 shrink-0" /> :
                            t.type === 'warning' ? <AlertTriangle className="w-4 h-4 shrink-0" /> :
                                <CheckCircle className="w-4 h-4 shrink-0" />}
                        <span className="max-w-xs">{t.message}</span>
                        <button
                            onClick={() => onDismiss(t.id)}
                            className="ml-2 opacity-60 hover:opacity-100 transition-opacity"
                        >✕</button>
                    </motion.div>
                ))}
            </AnimatePresence>
        </div>
    );
}

function ThreatScoreBadge({ score, classification }: { score: number; classification: string }) {
    const colors = SCORE_COLOR(score);
    const circumference = 2 * Math.PI * 40;
    const strokeDashoffset = circumference - (score / 100) * circumference;

    return (
        <div className={cn("relative flex flex-col items-center gap-3 p-5 rounded-2xl border", colors.bg, colors.border, colors.glow)}>
            {/* Circular Progress */}
            <div className="relative w-28 h-28">
                <svg className="w-28 h-28 -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
                    <circle
                        cx="50" cy="50" r="40" fill="none"
                        stroke={colors.hex}
                        strokeWidth="8"
                        strokeDasharray={circumference}
                        strokeDashoffset={strokeDashoffset}
                        strokeLinecap="round"
                        style={{ filter: `drop-shadow(0 0 6px ${colors.hex})`, transition: 'stroke-dashoffset 1.2s ease' }}
                    />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className={cn("text-3xl font-black font-mono", colors.text)}>{score}</span>
                    <span className="text-[9px] text-text-muted uppercase tracking-widest">/ 100</span>
                </div>
            </div>
            <div className="text-center">
                <p className="text-[10px] text-text-muted uppercase tracking-[0.2em] font-mono">Threat Score</p>
                <p className={cn("text-sm font-bold uppercase tracking-wider mt-0.5", colors.text)}>{classification}</p>
            </div>
        </div>
    );
}

function CollapsibleSection({ title, icon, children, defaultOpen = false, badgeCount }: {
    title: string;
    icon: React.ReactNode;
    children: React.ReactNode;
    defaultOpen?: boolean;
    badgeCount?: number;
}) {
    const [open, setOpen] = useState(defaultOpen);

    return (
        <div className="border border-border rounded-xl overflow-hidden">
            <button
                onClick={() => setOpen(o => !o)}
                className="w-full flex items-center justify-between p-4 bg-surface-highlight/30 hover:bg-surface-highlight/60 transition-colors"
            >
                <div className="flex items-center gap-2">
                    <span className="text-primary">{icon}</span>
                    <span className="text-xs font-bold text-foreground uppercase tracking-widest">{title}</span>
                    {badgeCount !== undefined && (
                        <span className="text-[9px] font-bold bg-primary/20 text-primary px-2 py-0.5 rounded-full border border-primary/30">
                            {badgeCount}
                        </span>
                    )}
                </div>
                {open ? <ChevronUp className="w-4 h-4 text-text-muted" /> : <ChevronDown className="w-4 h-4 text-text-muted" />}
            </button>
            <AnimatePresence initial={false}>
                {open && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                        className="overflow-hidden"
                    >
                        <div className="p-4">
                            {children}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

function CustomTooltipLine({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) {
    if (!active || !payload?.length) return null;
    return (
        <div className="bg-surface border border-border rounded-lg px-3 py-2 text-xs shadow-xl">
            <p className="text-text-muted font-mono">{label}</p>
            <p className="text-primary font-bold">{payload[0]?.value?.toLocaleString()} mentions</p>
        </div>
    );
}

function CustomTooltipBar({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) {
    if (!active || !payload?.length) return null;
    return (
        <div className="bg-surface border border-border rounded-lg px-3 py-2 text-xs shadow-xl">
            <p className="text-text-muted font-mono">{label}</p>
            <p className="text-secondary font-bold">{payload[0]?.value?.toLocaleString()} posts</p>
        </div>
    );
}

// ─── Empty-state placeholder shown inside a chart card ───────────────────────
function ChartEmpty({ label, icon }: { label: string; icon: React.ReactNode }) {
    return (
        <div className="flex flex-col items-center justify-center gap-3 h-[200px] opacity-40 select-none">
            <div className="text-text-dim">{icon}</div>
            <p className="text-[10px] font-mono text-text-dim uppercase tracking-widest text-center">
                {label}
            </p>
        </div>
    );
}

function AnalystCharts({ result }: { result: AnalysisResult }) {
    const hasPie = Array.isArray(result.platform_distribution) && result.platform_distribution.length > 0;
    const hasLine = Array.isArray(result.timeline_data) && result.timeline_data.length > 0;
    const hasBar = Array.isArray(result.narrative_clusters) && result.narrative_clusters.length > 0;

    // If all three datasets are missing, show a single consolidated notice
    if (!hasPie && !hasLine && !hasBar) {
        return (
            <div className="flex items-center gap-4 p-5 rounded-xl border border-border bg-surface-highlight/20 text-text-muted text-sm">
                <Info className="w-5 h-5 shrink-0 text-text-dim" />
                <span>
                    <span className="font-bold text-foreground">No chart data returned.</span>{' '}
                    The intelligence engine did not produce timeline, platform, or cluster data for this query.
                    Try a more descriptive input, or use one of the Quick Load scenarios.
                </span>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Line Chart — Timeline */}
            <motion.div variants={itemVariants} initial="hidden" animate="visible">
                <Card noPadding className="border-secondary/20 overflow-hidden">
                    <div className="flex items-center gap-3 p-4 border-b border-border bg-surface-highlight/20">
                        <Activity className="w-4 h-4 text-secondary" />
                        <h4 className="text-xs font-bold text-foreground uppercase tracking-widest">Activity Timeline</h4>
                        <span className="text-[9px] font-mono text-text-muted ml-auto">7-day engagement</span>
                        {!hasLine && (
                            <span className="text-[9px] font-mono text-risk-medium/70 uppercase tracking-widest">
                                ⚠ No data
                            </span>
                        )}
                    </div>
                    {hasLine ? (
                        <div className="p-4">
                            <ResponsiveContainer width="100%" height={200}>
                                <LineChart data={result.timeline_data} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                                    <XAxis
                                        dataKey="date"
                                        tick={{ fontSize: 9, fill: '#8b949e', fontFamily: 'monospace' }}
                                        tickFormatter={v => v.slice(5)}
                                        axisLine={false} tickLine={false}
                                    />
                                    <YAxis tick={{ fontSize: 9, fill: '#8b949e', fontFamily: 'monospace' }} axisLine={false} tickLine={false} />
                                    <Tooltip content={<CustomTooltipLine />} />
                                    <Line
                                        type="monotone"
                                        dataKey="mentions"
                                        stroke="#00f3ff"
                                        strokeWidth={2}
                                        dot={{ fill: '#00f3ff', r: 3, strokeWidth: 0 }}
                                        activeDot={{ r: 5, fill: '#00f3ff', stroke: 'rgba(0,243,255,0.3)', strokeWidth: 4 }}
                                        style={{ filter: 'drop-shadow(0 0 4px #00f3ff)' }}
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <ChartEmpty label="Timeline data not available for this query" icon={<Activity className="w-8 h-8" />} />
                    )}
                </Card>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Pie Chart — Platform Distribution */}
                <motion.div variants={itemVariants} initial="hidden" animate="visible" transition={{ delay: 0.1 }}>
                    <Card noPadding className="border-primary/20 overflow-hidden">
                        <div className="flex items-center gap-3 p-4 border-b border-border bg-surface-highlight/20">
                            <Share2 className="w-4 h-4 text-primary" />
                            <h4 className="text-xs font-bold text-foreground uppercase tracking-widest">Platform Distribution</h4>
                            {!hasPie && (
                                <span className="ml-auto text-[9px] font-mono text-risk-medium/70 uppercase tracking-widest">
                                    ⚠ No data
                                </span>
                            )}
                        </div>
                        {hasPie ? (
                            <div className="p-4">
                                <ResponsiveContainer width="100%" height={200}>
                                    <PieChart>
                                        <Pie
                                            data={result.platform_distribution}
                                            dataKey="percentage"
                                            nameKey="platform"
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={50}
                                            outerRadius={80}
                                            paddingAngle={3}
                                        >
                                            {result.platform_distribution.map((_, i) => (
                                                <Cell
                                                    key={i}
                                                    fill={PIE_COLORS[i % PIE_COLORS.length]}
                                                    style={{ filter: `drop-shadow(0 0 6px ${PIE_COLORS[i % PIE_COLORS.length]})` }}
                                                />
                                            ))}
                                        </Pie>
                                        <Tooltip
                                            contentStyle={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11 }}
                                            formatter={(v) => [`${v as number}%`, '']}
                                        />
                                        <Legend iconSize={8} wrapperStyle={{ fontSize: 10, color: 'var(--text-muted)' }} />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        ) : (
                            <ChartEmpty label="Platform breakdown not available" icon={<Share2 className="w-8 h-8" />} />
                        )}
                    </Card>
                </motion.div>

                {/* Bar Chart — Narrative Clusters */}
                <motion.div variants={itemVariants} initial="hidden" animate="visible" transition={{ delay: 0.2 }}>
                    <Card noPadding className="border-accent/20 overflow-hidden">
                        <div className="flex items-center gap-3 p-4 border-b border-border bg-surface-highlight/20">
                            <BarChart2 className="w-4 h-4 text-accent" />
                            <h4 className="text-xs font-bold text-foreground uppercase tracking-widest">Narrative Clusters</h4>
                            {!hasBar && (
                                <span className="ml-auto text-[9px] font-mono text-risk-medium/70 uppercase tracking-widest">
                                    ⚠ No data
                                </span>
                            )}
                        </div>
                        {hasBar ? (
                            <div className="p-4">
                                <ResponsiveContainer width="100%" height={200}>
                                    <BarChart data={result.narrative_clusters} margin={{ top: 5, right: 10, left: -20, bottom: 20 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                                        <XAxis
                                            dataKey="name"
                                            tick={{ fontSize: 8, fill: '#8b949e', fontFamily: 'monospace' }}
                                            axisLine={false} tickLine={false}
                                            angle={-20} textAnchor="end"
                                            interval={0}
                                        />
                                        <YAxis tick={{ fontSize: 9, fill: '#8b949e', fontFamily: 'monospace' }} axisLine={false} tickLine={false} />
                                        <Tooltip content={<CustomTooltipBar />} />
                                        <Bar dataKey="volume" radius={[4, 4, 0, 0]}>
                                            {result.narrative_clusters.map((_, i) => (
                                                <Cell
                                                    key={i}
                                                    fill={PIE_COLORS[i % PIE_COLORS.length]}
                                                    style={{ filter: `drop-shadow(0 0 4px ${PIE_COLORS[i % PIE_COLORS.length]})` }}
                                                />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        ) : (
                            <ChartEmpty label="Cluster data not available" icon={<BarChart2 className="w-8 h-8" />} />
                        )}
                    </Card>
                </motion.div>
            </div>
        </div>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function AIAnalystPage() {
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [result, setResult] = useState<AnalysisResult | null>(null);
    const [lastQuery, setLastQuery] = useState('');
    const [toasts, setToasts] = useState<ToastEntry[]>([]);
    const [isPending, setIsPending] = useState(false); // Prevent duplicate submissions
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const resultRef = useRef<HTMLDivElement>(null);

    const addToast = useCallback((type: ToastEntry['type'], message: string) => {
        const id = Date.now().toString();
        setToasts(prev => [...prev, { id, type, message }]);
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 5000);
    }, []);

    const dismissToast = useCallback((id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    // Auto-resize textarea
    useEffect(() => {
        const el = textareaRef.current;
        if (!el) return;
        el.style.height = 'auto';
        el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
    }, [input]);

    // Scroll to results
    useEffect(() => {
        if (result && resultRef.current) {
            setTimeout(() => {
                resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 200);
        }
    }, [result]);

    const handleAnalyze = useCallback(async () => {
        if (!input.trim() || isLoading || isPending) return;

        setIsPending(true);
        setIsLoading(true);
        setLastQuery(input.trim());

        // Client-side abort controller — 17s (slightly longer than server's 15s
        // so the server's timeout message reaches us before the client aborts).
        const clientAbort = new AbortController();
        const clientTimeout = setTimeout(() => clientAbort.abort(), 17_000);

        try {
            let res: Response;
            try {
                res = await fetch('/api/deeptrace-analyze', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ query: input.trim() }),
                    signal: clientAbort.signal,
                });
            } catch (fetchErr) {
                const isAbort = fetchErr instanceof Error && fetchErr.name === 'AbortError';
                addToast(
                    'error',
                    isAbort
                        ? 'Request timed out after 17 seconds. Try a shorter query or retry.'
                        : 'Network error — cannot reach analysis server.'
                );
                return;
            } finally {
                clearTimeout(clientTimeout);
            }

            // ── Status-code specific error messages ─────────────────────────
            if (res.status === 429) {
                addToast('warning', 'Rate limit reached — max 10 requests/minute. Please wait 60 seconds.');
                return;
            }
            if (res.status === 504) {
                addToast('error', 'Analysis timed out on server. Retry with a shorter or more focused query.');
                return;
            }
            if (res.status === 503) {
                addToast('error', 'Intelligence engine not configured. Set GEMINI_API_KEY in .env.local.');
                return;
            }

            let json: Record<string, unknown>;
            try {
                json = await res.json();
            } catch {
                addToast('error', 'Server returned a non-JSON response. Please retry.');
                return;
            }

            if (!res.ok || !json.success) {
                const msg = (json.error as string) || 'Analysis failed. Please retry.';
                // Surface Gemini's own error detail if the backend forwarded it
                const detail = json.details ? ` — ${json.details as string}` : '';
                addToast('error', `${msg}${detail}`.slice(0, 200));
                return;
            }

            // Partial validation warnings (non-blocking)
            if (Array.isArray(json.validation_errors) && (json.validation_errors as string[]).length > 0) {
                addToast('warning', `Partial data returned: ${(json.validation_errors as string[])[0]}`);
            }

            const analysisData = json.data as AnalysisResult;
            setResult(analysisData);

            // Autonomous alerts — checked against sanitised data from server
            if (analysisData.surge_alert) {
                addToast('warning', '⚡ SURGE ALERT — 40%+ activity growth detected in 24h window');
            }
            if (analysisData.coordination_detected) {
                addToast('warning', '🔗 COORDINATION SIGNAL — Synchronized cross-platform narrative detected');
            }
            if ((analysisData.threat_score ?? 0) > 75) {
                addToast('error', '⚠ CRITICAL THRESHOLD — Immediate monitoring recommended');
            }

        } finally {
            clearTimeout(clientTimeout);
            setIsLoading(false);
            setTimeout(() => setIsPending(false), 500);
        }
    }, [input, isLoading, isPending, addToast]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            handleAnalyze();
        }
    };

    const handleClear = () => {
        setInput('');
        setResult(null);
        setLastQuery('');
        if (textareaRef.current) textareaRef.current.style.height = 'auto';
    };

    const handleCopyResult = () => {
        if (!result) return;
        navigator.clipboard.writeText(JSON.stringify(result, null, 2));
        addToast('success', 'Intelligence report copied to clipboard.');
    };

    const colors = result ? SCORE_COLOR(result.threat_score) : null;

    return (
        <div className="flex flex-col gap-8 pb-16">
            <Toast toasts={toasts} onDismiss={dismissToast} />

            {/* ── Header ────────────────────────────────────────── */}
            <motion.div
                variants={itemVariants}
                initial="hidden"
                animate="visible"
                className="flex flex-col md:flex-row md:items-end justify-between gap-4"
            >
                <div>
                    <h1 className="text-3xl font-bold text-foreground tracking-tight flex items-center gap-3">
                        AI Analyst
                        <div className="p-1.5 bg-primary/10 rounded-lg text-primary shadow-[0_0_10px_rgba(0,255,65,0.15)]">
                            <Brain className="w-5 h-5" />
                        </div>
                    </h1>
                    <p className="text-text-muted text-sm mt-1">
                        Autonomous cyber-intelligence processing engine. Powered by DeepTrace LLM.
                    </p>
                </div>
                <div className="flex items-center gap-2 text-[10px] font-mono text-text-muted bg-surface-highlight border border-border px-3 py-2 rounded-lg">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse shadow-[0_0_6px_var(--primary)]" />
                    ENGINE ONLINE · v2.0
                </div>
            </motion.div>

            {/* ── Input Panel ────────────────────────────────────── */}
            <motion.div variants={itemVariants} initial="hidden" animate="visible" transition={{ delay: 0.1 }}>
                <Card className="border-primary/20 bg-surface/40 backdrop-blur-xl" noPadding>
                    {/* Header */}
                    <div className="flex items-center gap-3 px-5 py-3 border-b border-border bg-primary/5">
                        <div className="w-2 h-2 rounded-full bg-primary animate-pulse shadow-[0_0_8px_var(--primary)]" />
                        <span className="text-[10px] font-mono text-primary uppercase tracking-[0.2em]">Intelligence Input Terminal</span>
                        <span className="ml-auto text-[9px] text-text-dim font-mono">Ctrl+Enter to Execute</span>
                    </div>

                    <div className="p-5 space-y-4">
                        {/* Textarea */}
                        <div className="relative">
                            <textarea
                                ref={textareaRef}
                                value={input}
                                onChange={e => setInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                disabled={isLoading}
                                placeholder="▸ Awaiting Intelligence Input…&#10;&#10;Paste reports, logs, comment datasets, or describe a threat scenario. Examples:&#10;  • 'Analyze: High bot activity on election hashtags across 5 platforms'&#10;  • 'Deep dive: Coordinated narrative pushing anti-government content'&#10;  • 'Generate graph for: 7-day surge in border-crisis mentions'"
                                rows={4}
                                className={cn(
                                    "w-full resize-none bg-black/40 border border-border rounded-xl px-5 py-4",
                                    "text-sm text-foreground placeholder:text-text-dim/50",
                                    "focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30",
                                    "transition-all duration-200 font-mono leading-relaxed",
                                    "scrollbar-thin",
                                    isLoading && "opacity-60 cursor-not-allowed"
                                )}
                            />
                            {/* Character count */}
                            {input.length > 0 && (
                                <span className="absolute bottom-3 right-4 text-[9px] font-mono text-text-dim">
                                    {input.length}/4000
                                </span>
                            )}
                        </div>

                        {/* Suggested Queries */}
                        <div className="space-y-1.5">
                            <p className="text-[9px] font-mono text-text-dim uppercase tracking-widest">Quick Load Scenarios</p>
                            <div className="flex flex-wrap gap-2">
                                {SUGGESTED_QUERIES.map((q, i) => (
                                    <button
                                        key={i}
                                        onClick={() => setInput(q)}
                                        disabled={isLoading}
                                        className="text-[10px] px-3 py-1.5 rounded-lg bg-surface-highlight border border-border text-text-muted hover:text-primary hover:border-primary/30 hover:bg-primary/5 transition-all disabled:opacity-40 disabled:cursor-not-allowed truncate max-w-xs"
                                        title={q}
                                    >
                                        {i === 0 ? '📡 Anti-Gov Surge' : i === 1 ? '🔗 Coordination Op' : i === 2 ? '🤖 Botnet Threat' : '📊 Graph Mode'}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-3 pt-1">
                            <Button
                                variant="primary"
                                size="sm"
                                onClick={handleAnalyze}
                                disabled={!input.trim() || isLoading || isPending}
                                className={cn(
                                    "px-6 flex items-center gap-2 font-bold tracking-widest text-[11px]",
                                    "shadow-[0_0_20px_rgba(0,255,65,0.15)] transition-all duration-200",
                                    (!input.trim() || isLoading) && "opacity-40 cursor-not-allowed"
                                )}
                            >
                                {isLoading ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        ANALYZING…
                                    </>
                                ) : (
                                    <>
                                        <Send className="w-4 h-4" />
                                        RUN ANALYSIS
                                    </>
                                )}
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleClear}
                                disabled={(!input && !result) || isLoading}
                                className="flex items-center gap-2 text-[11px] font-bold tracking-widest"
                            >
                                <Trash2 className="w-4 h-4" />
                                CLEAR
                            </Button>
                        </div>
                    </div>
                </Card>
            </motion.div>

            {/* ── Loading State ─────────────────────────────────── */}
            <AnimatePresence>
                {isLoading && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.97 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.97 }}
                        transition={{ duration: 0.3 }}
                    >
                        <Card className="border-primary/20 bg-primary/5 overflow-hidden relative" noPadding>
                            {/* Animated scan line */}
                            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                                <div className="w-full h-px bg-gradient-to-r from-transparent via-primary to-transparent opacity-60 animate-scan-line" />
                            </div>
                            <div className="flex flex-col items-center gap-5 py-12 px-6">
                                <div className="relative">
                                    <div className="w-20 h-20 rounded-full border-2 border-primary/20" />
                                    <div className="absolute inset-0 w-20 h-20 rounded-full border-t-2 border-primary animate-spin" />
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <Brain className="w-7 h-7 text-primary animate-pulse" />
                                    </div>
                                </div>
                                <div className="text-center space-y-1">
                                    <p className="text-primary font-mono text-sm font-bold tracking-widest uppercase animate-pulse">
                                        Processing Intelligence…
                                    </p>
                                    <p className="text-text-muted text-xs">
                                        DeepTrace LLM is analyzing threat vectors and computing risk matrix
                                    </p>
                                </div>
                                <div className="flex gap-2">
                                    {['Parsing Input', 'Cluster Detection', 'Risk Scoring', 'Report Generation'].map((step, i) => (
                                        <div key={step} className="flex items-center gap-1.5 text-[9px] font-mono text-text-dim">
                                            <div
                                                className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"
                                                style={{ animationDelay: `${i * 0.3}s` }}
                                            />
                                            {step}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </Card>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Results Panel ─────────────────────────────────── */}
            <AnimatePresence>
                {result && !isLoading && (
                    <motion.div
                        ref={resultRef}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
                        className="space-y-6"
                    >
                        {/* Result Header */}
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className={cn("w-2 h-2 rounded-full animate-ping", colors?.text === 'text-risk-high' ? 'bg-risk-high' : 'bg-primary')} />
                                <h2 className="text-lg font-bold text-foreground tracking-tight">Intelligence Report</h2>
                                <span className="text-[9px] font-mono text-text-dim">Generated {new Date().toLocaleTimeString()}</span>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={handleCopyResult}
                                    className="flex items-center gap-1.5 text-[10px] text-text-muted hover:text-primary font-mono px-3 py-1.5 rounded border border-border hover:border-primary/30 transition-all"
                                >
                                    <Copy className="w-3 h-3" /> Export JSON
                                </button>
                                <button
                                    onClick={() => setResult(null)}
                                    className="flex items-center gap-1.5 text-[10px] text-text-muted hover:text-risk-high font-mono px-3 py-1.5 rounded border border-border hover:border-risk-high/30 transition-all"
                                >
                                    <RotateCcw className="w-3 h-3" /> New Query
                                </button>
                            </div>
                        </div>

                        {/* Warning Banner for high scores */}
                        {result.threat_score > 75 && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.98 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="flex items-center gap-4 p-4 rounded-xl border border-risk-high/40 bg-risk-high/10 shadow-[0_0_30px_rgba(255,0,60,0.1)]"
                            >
                                <div className="w-10 h-10 rounded-xl bg-risk-high/20 border border-risk-high/40 flex items-center justify-center shrink-0">
                                    <ShieldAlert className="w-5 h-5 text-risk-high animate-pulse" />
                                </div>
                                <div>
                                    <p className="text-risk-high font-bold text-sm">⚠ Immediate Monitoring Recommended</p>
                                    <p className="text-risk-high/70 text-xs mt-0.5">
                                        Threat score exceeds critical threshold. Escalate to tier-1 response team.
                                    </p>
                                </div>
                            </motion.div>
                        )}

                        {/* Surge / Coordination Flags */}
                        {(result.surge_alert || result.coordination_detected) && (
                            <div className="flex flex-wrap gap-3">
                                {result.surge_alert && (
                                    <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-risk-medium/40 bg-risk-medium/10 text-risk-medium">
                                        <Zap className="w-4 h-4" />
                                        <span className="text-xs font-bold uppercase tracking-widest">Surge Alert</span>
                                        <span className="text-[10px] opacity-70">40%+ growth in last 24h</span>
                                    </div>
                                )}
                                {result.coordination_detected && (
                                    <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-secondary/40 bg-secondary/10 text-secondary">
                                        <Share2 className="w-4 h-4" />
                                        <span className="text-xs font-bold uppercase tracking-widest">Coordination Signal</span>
                                        <span className="text-[10px] opacity-70">Cross-platform sync detected</span>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Top Row: Threat Score + Summary */}
                        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                            {/* Threat Score */}
                            <div className="lg:col-span-1">
                                <ThreatScoreBadge score={result.threat_score} classification={result.classification} />
                            </div>

                            {/* Summary */}
                            <Card className="lg:col-span-3 border-border bg-surface/50">
                                <div className="flex items-center gap-2 mb-3">
                                    <Info className="w-4 h-4 text-secondary" />
                                    <h3 className="text-xs font-bold uppercase tracking-widest text-secondary">Intelligence Summary</h3>
                                </div>
                                <p className="text-foreground text-sm leading-relaxed">
                                    {result.summary}
                                </p>
                                {result.autonomous_flags && result.autonomous_flags.length > 0 && (
                                    <div className="mt-4 space-y-1">
                                        {result.autonomous_flags.map((flag, i) => (
                                            <div key={i} className="flex items-center gap-2 text-[10px] font-mono text-risk-medium">
                                                <div className="w-1 h-1 rounded-full bg-risk-medium" />
                                                {flag}
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Input query display */}
                                <div className="mt-4 pt-3 border-t border-border">
                                    <p className="text-[9px] text-text-dim font-mono uppercase tracking-widest mb-1">Query Processed</p>
                                    <p className="text-[11px] text-text-muted font-mono truncate">{lastQuery.substring(0, 120)}{lastQuery.length > 120 ? '…' : ''}</p>
                                </div>
                            </Card>
                        </div>

                        {/* Charts */}
                        <AnalystCharts result={result} />

                        {/* Collapsible Sections */}
                        <div className="space-y-3">
                            {/* Risk Factors */}
                            {result.risk_factors?.length > 0 && (
                                <CollapsibleSection
                                    title="Risk Factors"
                                    icon={<AlertTriangle className="w-4 h-4" />}
                                    defaultOpen={true}
                                    badgeCount={result.risk_factors.length}
                                >
                                    <ul className="space-y-2">
                                        {result.risk_factors.map((f, i) => (
                                            <li key={i} className="flex items-start gap-3 text-sm text-foreground">
                                                <span className="text-risk-high font-bold font-mono text-[10px] mt-0.5 shrink-0">
                                                    RF-{String(i + 1).padStart(2, '0')}
                                                </span>
                                                <span className="leading-relaxed">{f}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </CollapsibleSection>
                            )}

                            {/* Recommendations */}
                            {result.recommendations?.length > 0 && (
                                <CollapsibleSection
                                    title="Mitigation Recommendations"
                                    icon={<CheckCircle className="w-4 h-4" />}
                                    defaultOpen={true}
                                    badgeCount={result.recommendations.length}
                                >
                                    <ul className="space-y-2">
                                        {result.recommendations.map((r, i) => (
                                            <li key={i} className="flex items-start gap-3 text-sm text-foreground">
                                                <span className="text-primary font-bold font-mono text-[10px] mt-0.5 shrink-0">
                                                    ACT-{String(i + 1).padStart(2, '0')}
                                                </span>
                                                <span className="leading-relaxed">{r}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </CollapsibleSection>
                            )}

                            {/* Cluster Breakdown */}
                            {result.narrative_clusters?.length > 0 && (
                                <CollapsibleSection
                                    title="Cluster Breakdown"
                                    icon={<BarChart2 className="w-4 h-4" />}
                                    defaultOpen={false}
                                    badgeCount={result.narrative_clusters.length}
                                >
                                    <div className="space-y-3">
                                        {result.narrative_clusters.map((c, i) => (
                                            <div key={i} className="p-3 rounded-lg bg-surface-highlight/30 border border-border space-y-1.5">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-sm font-bold text-foreground">{c.name}</span>
                                                    <div className="flex items-center gap-2">
                                                        <span className={cn("text-[9px] font-bold uppercase px-2 py-0.5 rounded-full", SENTIMENT_COLOR(c.sentiment))}>
                                                            {c.sentiment}
                                                        </span>
                                                        <span className="text-[10px] font-mono text-text-muted">{c.volume?.toLocaleString()} posts</span>
                                                    </div>
                                                </div>
                                                {c.description && (
                                                    <p className="text-xs text-text-muted leading-relaxed">{c.description}</p>
                                                )}
                                                {/* Volume bar */}
                                                <div className="h-1 w-full bg-surface rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full rounded-full transition-all duration-700"
                                                        style={{
                                                            width: `${Math.min(100, (c.volume / (Math.max(...result.narrative_clusters.map(x => x.volume)) || 1)) * 100)}%`,
                                                            backgroundColor: PIE_COLORS[i % PIE_COLORS.length],
                                                            boxShadow: `0 0 6px ${PIE_COLORS[i % PIE_COLORS.length]}`,
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </CollapsibleSection>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Empty State ────────────────────────────────────── */}
            {!result && !isLoading && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    className="flex flex-col items-center gap-6 py-16 text-center"
                >
                    <div className="relative">
                        <div className="w-24 h-24 rounded-full border border-primary/10 bg-primary/5 flex items-center justify-center">
                            <Brain className="w-10 h-10 text-primary/40" />
                        </div>
                        <div className="absolute inset-0 w-24 h-24 rounded-full border border-primary/5 animate-ping" />
                    </div>
                    <div className="space-y-2">
                        <p className="text-text-muted font-mono text-sm uppercase tracking-widest">Awaiting Intelligence Input</p>
                        <p className="text-text-dim text-xs max-w-sm">
                            Paste a report, log, dataset, or threat description above and click Run Analysis to generate a structured intelligence report.
                        </p>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[10px] font-mono text-text-dim">
                        {['Threat Scoring', 'Cluster Detection', 'Surge Alerts', 'Interactive Charts'].map(f => (
                            <div key={f} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-surface-highlight/20">
                                <div className="w-1.5 h-1.5 rounded-full bg-primary/50" />
                                {f}
                            </div>
                        ))}
                    </div>
                </motion.div>
            )}
        </div>
    );
}
