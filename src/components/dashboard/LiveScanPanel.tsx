'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Search, Video, MessageSquare, Zap, AlertCircle } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

export interface LiveScanResult {
    success: boolean;
    source: string;
    total_videos_scanned: number;
    total_comments_analyzed: number;
    risk_score: number;
    risk_level: 'low' | 'medium' | 'high';
    signals: {
        cross_video_similarity: number;
        account_reuse: number;
        temporal_burst: number;
    };
    explanation: string;
}

interface LiveScanPanelProps {
    onResult: (result: LiveScanResult) => void;
    onError: (msg: string) => void;
    isLoading: boolean;
    setIsLoading: (v: boolean) => void;
}

export function LiveScanPanel({ onResult, onError, isLoading, setIsLoading }: LiveScanPanelProps) {
    const [query, setQuery] = useState('');
    const [maxVideos, setMaxVideos] = useState(3);
    const [maxComments, setMaxComments] = useState(10);

    const handleAnalyze = async () => {
        if (!query.trim()) return;

        setIsLoading(true);
        onError('');

        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
            const response = await fetch(`${apiUrl}/api/youtube/analyze-cross-video`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    query: query.trim(),
                    max_videos: maxVideos,
                    max_comments_per_video: maxComments,
                }),
            });

            if (!response.ok) {
                throw new Error(`API Error: ${response.status} ${response.statusText}`);
            }

            const data: LiveScanResult = await response.json();
            console.log('🔴 [Live Scan] Cross-Video Analysis Response:', data);
            onResult(data);
        } catch (err) {
            console.error('❌ [Live Scan] Error:', err);
            onError('Live Scan Failed. Please check backend connection.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
        >
            <Card
                variant="neon"
                className="relative overflow-hidden"
                style={{
                    border: '1px solid rgba(255, 0, 60, 0.25)',
                    boxShadow: '0 0 30px rgba(255, 0, 60, 0.05), inset 0 0 30px rgba(255, 0, 60, 0.02)',
                }}
            >
                {/* Top scanline effect */}
                <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-risk-high/50 to-transparent" />

                {/* Corner decoration */}
                <div className="absolute top-3 right-3 flex items-center gap-1.5">
                    <motion.div
                        animate={{ opacity: [1, 0.3, 1] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                        className="w-2 h-2 rounded-full bg-risk-high shadow-[0_0_6px_var(--risk-high)]"
                    />
                    <span className="text-[9px] font-mono text-risk-high/70 uppercase tracking-widest">Live Mode</span>
                </div>

                <div className="space-y-6">
                    {/* Header */}
                    <div className="flex items-center gap-3 pr-24">
                        <div className="p-2.5 bg-risk-high/10 rounded border border-risk-high/20">
                            <Zap className="w-4 h-4 text-risk-high" />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-foreground uppercase tracking-widest">
                                Cross-Video Coordination Scanner
                            </h3>
                            <p className="text-[11px] text-text-muted mt-0.5 font-mono">
                                Real-time AI analysis of coordinated behaviour across YouTube videos
                            </p>
                        </div>
                    </div>

                    {/* Main Query Input */}
                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-text-dim uppercase tracking-widest flex items-center gap-2">
                            <Search className="w-3 h-3" />
                            YouTube Search Query
                        </label>
                        <div className="relative group">
                            <input
                                id="live-scan-query"
                                type="text"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && !isLoading && handleAnalyze()}
                                placeholder="e.g. India election misinformation, Anti-India propaganda..."
                                className="w-full bg-background border border-border rounded-sm px-4 py-3 text-sm text-foreground placeholder:text-text-dim focus:border-risk-high/70 focus:outline-none focus:ring-2 focus:ring-risk-high/10 transition-all font-mono"
                                disabled={isLoading}
                            />
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-text-dim font-mono hidden group-focus-within:block">
                                ENTER ↵
                            </div>
                        </div>
                    </div>

                    {/* Parameters Row */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-text-dim uppercase tracking-widest flex items-center gap-2">
                                <Video className="w-3 h-3" />
                                Max Videos
                            </label>
                            <div className="relative">
                                <input
                                    id="live-scan-max-videos"
                                    type="number"
                                    min={1}
                                    max={10}
                                    value={maxVideos}
                                    onChange={(e) => setMaxVideos(Number(e.target.value))}
                                    className="w-full bg-background border border-border rounded-sm px-4 py-2.5 text-sm text-foreground focus:border-risk-high/70 focus:outline-none focus:ring-2 focus:ring-risk-high/10 transition-all font-mono"
                                    disabled={isLoading}
                                />
                            </div>
                            <p className="text-[10px] text-text-dim">Videos to scan (1–10)</p>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-text-dim uppercase tracking-widest flex items-center gap-2">
                                <MessageSquare className="w-3 h-3" />
                                Max Comments / Video
                            </label>
                            <div className="relative">
                                <input
                                    id="live-scan-max-comments"
                                    type="number"
                                    min={5}
                                    max={50}
                                    value={maxComments}
                                    onChange={(e) => setMaxComments(Number(e.target.value))}
                                    className="w-full bg-background border border-border rounded-sm px-4 py-2.5 text-sm text-foreground focus:border-risk-high/70 focus:outline-none focus:ring-2 focus:ring-risk-high/10 transition-all font-mono"
                                    disabled={isLoading}
                                />
                            </div>
                            <p className="text-[10px] text-text-dim">Comments per video (5–50)</p>
                        </div>
                    </div>

                    {/* Analyze Button */}
                    <button
                        id="live-scan-analyze-btn"
                        onClick={handleAnalyze}
                        disabled={isLoading || !query.trim()}
                        className="w-full relative overflow-hidden flex items-center justify-center gap-3 px-6 py-3.5 rounded-sm font-bold text-xs uppercase tracking-[0.12em] transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed group"
                        style={{
                            background: isLoading
                                ? 'rgba(255, 0, 60, 0.1)'
                                : 'linear-gradient(135deg, rgba(255, 0, 60, 0.15) 0%, rgba(255, 0, 60, 0.05) 100%)',
                            border: '1px solid rgba(255, 0, 60, 0.4)',
                            color: 'var(--risk-high)',
                            boxShadow: isLoading ? 'none' : '0 0 20px rgba(255, 0, 60, 0.1)',
                        }}
                    >
                        {/* Shimmer on hover */}
                        {!isLoading && (
                            <motion.div
                                className="absolute inset-0 bg-gradient-to-r from-transparent via-risk-high/10 to-transparent -translate-x-full group-hover:translate-x-full"
                                transition={{ duration: 0.6 }}
                            />
                        )}

                        {isLoading ? (
                            <>
                                {/* Custom cyber spinner */}
                                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
                                    <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                </svg>
                                Running Cross-Video Coordination Analysis...
                            </>
                        ) : (
                            <>
                                <Zap className="w-4 h-4" />
                                Initiate Deep Scan
                                <span className="absolute right-4 text-[10px] font-mono opacity-50">⌘ ENTER</span>
                            </>
                        )}
                    </button>

                    {/* Loading progress bar */}
                    {isLoading && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="space-y-2"
                        >
                            <div className="h-0.5 bg-surface-highlight rounded-full overflow-hidden">
                                <motion.div
                                    animate={{ x: ['-100%', '100%'] }}
                                    transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                                    className="h-full w-1/2 bg-gradient-to-r from-transparent via-risk-high to-transparent"
                                />
                            </div>
                            <p className="text-[10px] text-text-dim font-mono text-center tracking-widest">
                                SCANNING YOUTUBE — COMPUTING COORDINATION VECTORS...
                            </p>
                        </motion.div>
                    )}
                </div>

                {/* Bottom scanline */}
                <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-risk-high/30 to-transparent" />
            </Card>
        </motion.div>
    );
}
