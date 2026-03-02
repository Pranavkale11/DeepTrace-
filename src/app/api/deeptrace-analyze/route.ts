import { NextRequest, NextResponse } from 'next/server';

// ─────────────────────────────────────────────────────────────────────────────
// RATE LIMITER
//
// Bypass-hardening: we use a per-IP in-flight counter in addition to the
// sliding window counter.  Both checks happen synchronously inside a single
// JS-event-loop tick, which is safe because Node.js is single-threaded.
// The in-flight guard prevents a burst of concurrent requests from all
// reading count < RATE_LIMIT before any of them increments it.
// ─────────────────────────────────────────────────────────────────────────────
interface RateLimitRecord {
    count: number;
    resetAt: number;
    inFlight: number; // concurrent requests currently executing
}

const rateLimitStore = new Map<string, RateLimitRecord>();
const RATE_LIMIT = 10;         // max completed requests per window
const IN_FLIGHT_LIMIT = 3;     // max concurrent in-flight requests per IP
const RATE_WINDOW_MS = 60_000; // 60 seconds

/** Returns true and increments counters if the request is allowed. */
function acquireSlot(ip: string): boolean {
    const now = Date.now();
    let rec = rateLimitStore.get(ip);

    if (!rec || now > rec.resetAt) {
        rec = { count: 0, resetAt: now + RATE_WINDOW_MS, inFlight: 0 };
        rateLimitStore.set(ip, rec);
    }

    // Reject if completed request budget is exhausted OR too many concurrent
    if (rec.count >= RATE_LIMIT) return false;
    if (rec.inFlight >= IN_FLIGHT_LIMIT) return false;

    rec.count += 1;
    rec.inFlight += 1;
    return true;
}

/** Call after each request completes (success or error). */
function releaseSlot(ip: string): void {
    const rec = rateLimitStore.get(ip);
    if (rec && rec.inFlight > 0) rec.inFlight -= 1;
}

// ─────────────────────────────────────────────────────────────────────────────
// DETERMINISTIC CLASSIFICATION
//
// The classification label is NEVER taken from the LLM output.
// It is computed server-side from the validated threat_score so it is always
// consistent regardless of what wording the model chose.
// ─────────────────────────────────────────────────────────────────────────────
function classifyScore(score: number): 'Low' | 'Moderate' | 'High' | 'Critical' {
    if (score <= 30) return 'Low';
    if (score <= 60) return 'Moderate';
    if (score <= 80) return 'High';
    return 'Critical';
}

// ─────────────────────────────────────────────────────────────────────────────
// STRICT JSON SANITISATION
//
// 1. Every required key is validated for type AND shape.
// 2. threat_score is clamped to [0, 100] and rounded to an integer.
// 3. classification is overwritten by classifyScore (deterministic).
// 4. timeline_data items must have { date: YYYY-MM-DD, mentions: number }.
// 5. platform_distribution items must have { platform: string, percentage: number }.
// 6. Percentage sum is normalised to 100 if it drifts outside [98, 102].
// 7. Unknown top-level keys are stripped (whitelist approach).
// 8. String fields are truncated to safe lengths.
// ─────────────────────────────────────────────────────────────────────────────
type RawLLMOutput = Record<string, unknown>;

interface SanitisedOutput {
    summary: string;
    threat_score: number;
    classification: 'Low' | 'Moderate' | 'High' | 'Critical';
    narrative_clusters: Array<{ name: string; volume: number; sentiment: string; description: string }>;
    timeline_data: Array<{ date: string; mentions: number }>;
    platform_distribution: Array<{ platform: string; percentage: number }>;
    risk_factors: string[];
    recommendations: string[];
    surge_alert: boolean;
    coordination_detected: boolean;
    autonomous_flags: string[];
}

interface ValidationResult {
    ok: boolean;
    data: SanitisedOutput;
    errors: string[];
    warnings: string[];
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function sanitiseAndValidate(raw: RawLLMOutput): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // ── summary ──────────────────────────────────────────────────────────────
    let summary = typeof raw.summary === 'string' ? raw.summary.trim() : '';
    if (!summary) {
        errors.push('Missing "summary"');
        summary = 'Insufficient data for full assessment.';
    } else if (summary.length > 1000) {
        warnings.push('"summary" truncated to 1000 chars');
        summary = summary.slice(0, 1000);
    }

    // ── threat_score ─────────────────────────────────────────────────────────
    let rawScore = raw.threat_score;
    if (typeof rawScore === 'string') rawScore = parseFloat(rawScore);  // coerce "72" → 72
    let threat_score: number;
    if (typeof rawScore !== 'number' || isNaN(rawScore)) {
        errors.push('Invalid "threat_score": must be a number');
        threat_score = 0;
    } else {
        threat_score = Math.round(Math.max(0, Math.min(100, rawScore)));
    }

    // ── classification (always deterministic, LLM value IGNORED) ─────────────
    const classification = classifyScore(threat_score);
    if (
        typeof raw.classification === 'string' &&
        raw.classification !== classification
    ) {
        warnings.push(
            `LLM classification "${raw.classification}" overridden → "${classification}" (derived from score ${threat_score})`
        );
    }

    // ── timeline_data ─────────────────────────────────────────────────────────
    let timeline_data: Array<{ date: string; mentions: number }> = [];
    if (!Array.isArray(raw.timeline_data)) {
        errors.push('Missing "timeline_data" array');
    } else {
        timeline_data = raw.timeline_data
            .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
            .map((item, i) => {
                const date = typeof item.date === 'string' ? item.date.trim() : '';
                if (!DATE_RE.test(date)) warnings.push(`timeline_data[${i}].date invalid: "${date}"`);
                const rawMentions = item.mentions;
                const mentions =
                    typeof rawMentions === 'number'
                        ? Math.max(0, Math.round(rawMentions))
                        : parseInt(String(rawMentions), 10) || 0;
                return { date: date || `2025-01-0${i + 1}`, mentions };
            })
            .slice(0, 30); // max 30 data points
    }

    // ── platform_distribution ────────────────────────────────────────────────
    let platform_distribution: Array<{ platform: string; percentage: number }> = [];
    if (!Array.isArray(raw.platform_distribution)) {
        errors.push('Missing "platform_distribution" array');
    } else {
        platform_distribution = raw.platform_distribution
            .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
            .map((item) => {
                const platform = typeof item.platform === 'string' ? item.platform.trim().slice(0, 50) : 'Unknown';
                const rawPct = item.percentage;
                const percentage =
                    typeof rawPct === 'number'
                        ? Math.max(0, rawPct)
                        : parseFloat(String(rawPct)) || 0;
                return { platform, percentage };
            })
            .slice(0, 10); // max 10 platforms

        // Normalise percentages to sum = 100
        const total = platform_distribution.reduce((s, p) => s + p.percentage, 0);
        if (total > 0 && (total < 98 || total > 102)) {
            warnings.push(`platform_distribution sum was ${total.toFixed(1)}% — normalised to 100%`);
            platform_distribution = platform_distribution.map(p => ({
                ...p,
                percentage: Math.round((p.percentage / total) * 1000) / 10,
            }));
        }
    }

    // ── narrative_clusters ───────────────────────────────────────────────────
    let narrative_clusters: Array<{ name: string; volume: number; sentiment: string; description: string }> = [];
    if (!Array.isArray(raw.narrative_clusters)) {
        errors.push('Missing "narrative_clusters" array');
    } else {
        narrative_clusters = raw.narrative_clusters
            .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
            .map((item) => ({
                name: String(item.name || 'Unnamed Cluster').slice(0, 100),
                volume: Math.max(0, Math.round(Number(item.volume) || 0)),
                sentiment: ['positive', 'negative', 'neutral'].includes(String(item.sentiment))
                    ? String(item.sentiment)
                    : 'neutral',
                description: String(item.description || '').slice(0, 300),
            }))
            .slice(0, 8);
    }

    // ── simple string arrays ─────────────────────────────────────────────────
    const toStringArr = (key: string, maxItems = 10, maxLen = 300): string[] => {
        if (!Array.isArray(raw[key])) {
            errors.push(`Missing "${key}" array`);
            return [];
        }
        return (raw[key] as unknown[])
            .filter(v => typeof v === 'string')
            .map(v => (v as string).trim().slice(0, maxLen))
            .filter(Boolean)
            .slice(0, maxItems) as string[];
    };

    const risk_factors = toStringArr('risk_factors', 10, 300);
    const recommendations = toStringArr('recommendations', 10, 300);
    const autonomous_flags = toStringArr('autonomous_flags', 10, 200);

    // ── boolean flags ─────────────────────────────────────────────────────────
    const surge_alert = raw.surge_alert === true;
    const coordination_detected = raw.coordination_detected === true;

    const data: SanitisedOutput = {
        summary,
        threat_score,
        classification,
        narrative_clusters,
        timeline_data,
        platform_distribution,
        risk_factors,
        recommendations,
        surge_alert,
        coordination_detected,
        autonomous_flags,
    };

    return { ok: errors.length === 0, data, errors, warnings };
}

// ─────────────────────────────────────────────────────────────────────────────
// GROQ CONFIGURATION (OpenAI-compatible)
// ─────────────────────────────────────────────────────────────────────────────
const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama3-70b-8192';

// Startup check — logged once when the module is first loaded by Next.js.
console.log('[DT-ANALYST] Groq Key Loaded:', !!process.env.GROQ_API_KEY && process.env.GROQ_API_KEY !== 'your_groq_key_here');
console.log('[DT-ANALYST] Model           :', GROQ_MODEL);
console.log('[DT-ANALYST] Base Endpoint   :', GROQ_ENDPOINT);

const DEEPTRACE_SYSTEM_PROMPT = `You are the DeepTrace AI Analyst — an autonomous cyber-intelligence processing engine. You are NOT a chatbot.

RETURN ONLY VALID JSON. No markdown fences. No prose before or after.

REQUIRED JSON SCHEMA (all fields mandatory):
{
  "summary": "<2-3 sentence intelligence assessment>",
  "threat_score": <integer 0-100>,
  "classification": "<Low|Moderate|High|Critical>",
  "narrative_clusters": [
    { "name": "<string>", "volume": <integer>, "sentiment": "<positive|negative|neutral>", "description": "<string>" }
  ],
  "timeline_data": [
    { "date": "<YYYY-MM-DD>", "mentions": <integer> }
  ],
  "platform_distribution": [
    { "platform": "<string>", "percentage": <number summing to 100> }
  ],
  "risk_factors": ["<string>"],
  "recommendations": ["<string>"],
  "surge_alert": <true|false>,
  "coordination_detected": <true|false>,
  "autonomous_flags": ["<string>"]
}

SCORING RULES:
- 0-30: Low. 31-60: Moderate. 61-80: High. 81-100: Critical.
- threat_score must be an integer.
- classification must match the score range exactly.

TIMELINE: Generate 7 daily entries (past 7 days) based on threat context.
PLATFORMS: Percentages must sum to exactly 100.
CLUSTERS: 2-4 distinct narrative clusters.
SURGE ALERT: true only if 40%+ growth in 24h is evidenced.
COORDINATION: true only if same narrative on 3+ platforms simultaneously.
INSUFFICIENT DATA: Still output all fields; use threat_score 15 or below and note in summary.

DO NOT include markdown, HTML, or prose outside the JSON object.`;

/**
 * Calls the Groq Chat Completions endpoint (OpenAI compatible).
 */
async function callGroq(
    apiKey: string,
    userQuery: string,
    signal: AbortSignal
): Promise<Response> {
    console.log(`[DT-ANALYST] Calling Groq | model:${GROQ_MODEL} | url:${GROQ_ENDPOINT}`);
    return fetch(GROQ_ENDPOINT, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        signal,
        body: JSON.stringify({
            model: GROQ_MODEL,
            messages: [
                {
                    role: 'system',
                    content: DEEPTRACE_SYSTEM_PROMPT
                },
                {
                    role: 'user',
                    content: userQuery
                }
            ],
            temperature: 0.3,
            max_tokens: 2048,
        }),
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// LOGGER
// ─────────────────────────────────────────────────────────────────────────────
function logRequest(ip: string, query: string, status: string, durationMs?: number) {
    console.log(
        `[DT-ANALYST] ${new Date().toISOString()} | ${status} | IP:${ip} | ${durationMs != null ? `${durationMs}ms | ` : ''
        }Q:${query.slice(0, 80)}${query.length > 80 ? '…' : ''}`
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// ROUTE HANDLER
// ─────────────────────────────────────────────────────────────────────────────
const REQUEST_TIMEOUT_MS = 15_000; // 15 seconds hard timeout

export async function POST(req: NextRequest) {
    const start = Date.now();

    // ── IP resolution ─────────────────────────────────────────────────────────
    const ip =
        req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
        req.headers.get('x-real-ip') ||
        'unknown';

    // ── Rate limit (atomic within JS event loop) ───────────────────────────────
    if (!acquireSlot(ip)) {
        logRequest(ip, '—', 'RATE_LIMITED');
        return NextResponse.json(
            {
                success: false,
                error: 'Rate limit exceeded. Maximum 10 requests per minute (3 concurrent). Please wait.'
            },
            { status: 429, headers: { 'Retry-After': '60' } }
        );
    }

    // ── Parse body ────────────────────────────────────────────────────────────
    let query: string;
    try {
        const body = await req.json();
        query = typeof body?.query === 'string' ? body.query.trim() : '';
        if (!query) {
            releaseSlot(ip);
            return NextResponse.json(
                { success: false, error: 'Invalid request: "query" field is required and must be a non-empty string.' },
                { status: 400 }
            );
        }
        query = query.slice(0, 4000); // hard limit
    } catch {
        releaseSlot(ip);
        return NextResponse.json({ success: false, error: 'Malformed JSON body.' }, { status: 400 });
    }

    // ── API key guard ─────────────────────────────────────────────────────────
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey || apiKey === 'your_groq_key_here' || apiKey === 'your_actual_groq_key_here') {
        releaseSlot(ip);
        console.error('[DT-ANALYST] GROQ_API_KEY not configured');
        return NextResponse.json(
            { success: false, error: 'Intelligence engine not configured. Set GROQ_API_KEY in .env.local.' },
            { status: 503 }
        );
    }

    logRequest(ip, query, 'START');

    // ── Call Groq with 15s AbortController timeout ─────────────────────────────
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
        let groqRes: Response;
        try {
            // ── Single call to Groq ──
            groqRes = await callGroq(apiKey, query, controller.signal);
        } catch (fetchErr) {
            const isTimeout =
                fetchErr instanceof Error &&
                (fetchErr.name === 'AbortError' || fetchErr.message.includes('aborted'));

            logRequest(ip, query, isTimeout ? 'TIMEOUT' : 'FETCH_ERROR', Date.now() - start);
            releaseSlot(ip);
            return NextResponse.json(
                {
                    success: false,
                    error: isTimeout
                        ? 'Analysis timed out after 15 seconds. Please retry with a shorter query.'
                        : 'Unable to reach intelligence engine. Check network connectivity.',
                },
                { status: isTimeout ? 504 : 502 }
            );
        } finally {
            clearTimeout(timeoutId);
        }

        if (!groqRes.ok) {
            // Capture and log the full Groq error body for diagnosis
            const errText = await groqRes.text().catch(() => '(could not read error body)');
            console.error(
                `[DT-ANALYST] Groq Error HTTP ${groqRes.status} | model:${GROQ_MODEL}`,
                '\nResponse body:', errText.slice(0, 800)
            );
            logRequest(ip, query, `GROQ_${groqRes.status}`, Date.now() - start);
            releaseSlot(ip);

            // Parse Groq error detail if response is JSON
            let groqErrorDetail = errText;
            try {
                const parsed = JSON.parse(errText);
                groqErrorDetail = parsed?.error?.message || errText;
            } catch { /* not JSON — use raw text */ }

            return NextResponse.json(
                {
                    success: false,
                    error: `Intelligence engine returned HTTP ${groqRes.status} (model: ${GROQ_MODEL}).`,
                    details: groqErrorDetail.slice(0, 300),
                },
                { status: 502 }
            );
        }

        console.log(`[DT-ANALYST] Groq OK | model:${GROQ_MODEL}`);


        // ── Extract raw text (OpenAI compatible chat completions format) ──
        const groqData = await groqRes.json();
        const rawText: string = groqData.choices?.[0]?.message?.content?.trim() ?? '';

        if (!rawText) {
            logRequest(ip, query, 'EMPTY_RESPONSE', Date.now() - start);
            releaseSlot(ip);
            return NextResponse.json(
                { success: false, error: 'Intelligence engine returned an empty response. Please retry.' },
                { status: 502 }
            );
        }

        // ── Parse JSON (strip markdown fences if model ignores the mime type) ────
        let rawParsed: RawLLMOutput;
        try {
            const cleaned = rawText
                .replace(/^```(?:json)?\s*/i, '')
                .replace(/\s*```\s*$/, '')
                .trim();
            rawParsed = JSON.parse(cleaned);

            if (typeof rawParsed !== 'object' || Array.isArray(rawParsed) || rawParsed === null) {
                throw new Error('Top-level value is not a JSON object');
            }
        } catch (parseErr) {
            console.error(
                '[DT-ANALYST] JSON parse failed:',
                parseErr instanceof Error ? parseErr.message : parseErr,
                '| Raw (first 400):', rawText.slice(0, 400)
            );
            logRequest(ip, query, 'JSON_PARSE_FAIL', Date.now() - start);
            releaseSlot(ip);
            return NextResponse.json(
                {
                    success: false,
                    error: 'Graph data format invalid. Intelligence engine returned malformed output. Please retry.',
                },
                { status: 502 }
            );
        }

        // ── Strict sanitisation & validation ────────────────────────────────────
        const { ok, data, errors, warnings } = sanitiseAndValidate(rawParsed);

        if (!ok) {
            console.warn('[DT-ANALYST] Validation errors:', errors);
        }
        if (warnings.length > 0) {
            console.info('[DT-ANALYST] Validation warnings:', warnings);
        }

        const durationMs = Date.now() - start;
        logRequest(ip, query, ok ? 'OK' : 'PARTIAL', durationMs);
        releaseSlot(ip);

        return NextResponse.json({
            success: true,
            data,
            validation_errors: errors,
            validation_warnings: warnings,
            duration_ms: durationMs,
            timestamp: new Date().toISOString(),
        });

    } catch (err) {
        clearTimeout(timeoutId);
        console.error('[DT-ANALYST] Unhandled error:', err);
        logRequest(ip, query, 'INTERNAL_ERROR', Date.now() - start);
        releaseSlot(ip);
        return NextResponse.json(
            { success: false, error: 'Internal intelligence system error. Please retry.' },
            { status: 500 }
        );
    }
}
