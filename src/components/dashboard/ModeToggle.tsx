'use client';

import { motion } from 'framer-motion';
import { Database, Radio } from 'lucide-react';
import { cn } from '@/lib/utils';

export type IntelligenceMode = 'static' | 'live';

interface ModeToggleProps {
    mode: IntelligenceMode;
    onModeChange: (mode: IntelligenceMode) => void;
}

export function ModeToggle({ mode, onModeChange }: ModeToggleProps) {
    return (
        <div className="flex items-center gap-3">
            <span className="text-xs font-mono text-text-dim uppercase tracking-widest hidden sm:block">
                Intelligence Mode
            </span>
            <div
                className="relative flex items-center bg-surface border border-border rounded-sm p-1 gap-1"
                style={{ boxShadow: '0 0 0 1px var(--border)' }}
            >
                {/* Animated background pill */}
                <motion.div
                    className={cn(
                        'absolute top-1 bottom-1 rounded-sm',
                        mode === 'live'
                            ? 'bg-risk-high/15 border border-risk-high/30'
                            : 'bg-primary/10 border border-primary/30'
                    )}
                    layoutId="mode-pill"
                    initial={false}
                    animate={{
                        left: mode === 'static' ? '4px' : '50%',
                        right: mode === 'static' ? '50%' : '4px',
                    }}
                    transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                />

                {/* Static Mode Button */}
                <button
                    id="mode-toggle-static"
                    onClick={() => onModeChange('static')}
                    className={cn(
                        'relative z-10 flex items-center gap-2 px-4 py-2 rounded-sm text-xs font-bold uppercase tracking-[0.08em] transition-colors duration-300 min-w-[140px] justify-center',
                        mode === 'static'
                            ? 'text-primary'
                            : 'text-text-muted hover:text-foreground'
                    )}
                >
                    <Database
                        className={cn(
                            'w-3.5 h-3.5 transition-all duration-300',
                            mode === 'static' ? 'text-primary drop-shadow-[0_0_4px_rgba(0,255,65,0.6)]' : ''
                        )}
                    />
                    Static Intelligence
                </button>

                {/* Live Mode Button */}
                <button
                    id="mode-toggle-live"
                    onClick={() => onModeChange('live')}
                    className={cn(
                        'relative z-10 flex items-center gap-2 px-4 py-2 rounded-sm text-xs font-bold uppercase tracking-[0.08em] transition-colors duration-300 min-w-[160px] justify-center',
                        mode === 'live'
                            ? 'text-risk-high'
                            : 'text-text-muted hover:text-foreground'
                    )}
                >
                    <span className="relative flex items-center justify-center">
                        <Radio
                            className={cn(
                                'w-3.5 h-3.5 transition-all duration-300',
                                mode === 'live' ? 'text-risk-high drop-shadow-[0_0_4px_rgba(255,0,60,0.6)]' : ''
                            )}
                        />
                        {mode === 'live' && (
                            <motion.span
                                initial={{ scale: 0.8, opacity: 0 }}
                                animate={{ scale: [1, 1.8, 1], opacity: [1, 0, 0] }}
                                transition={{ duration: 1.5, repeat: Infinity, ease: 'easeOut' }}
                                className="absolute inset-0 rounded-full border border-risk-high"
                            />
                        )}
                    </span>
                    🔴 Live YouTube Scan
                </button>
            </div>
        </div>
    );
}
