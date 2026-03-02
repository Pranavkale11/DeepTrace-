// API Configuration
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// Types based on backend API responses
export interface AnalyticsOverviewResponse {
    success: boolean;
    data: {
        stats: {
            total_campaigns: number;
            active_threats: number;
            high_risk_campaigns: number;
            total_accounts_monitored: number;
            total_posts_analyzed: number;
            bot_accounts_detected: number;
        };
        threat_distribution: {
            critical: number;
            high: number;
            medium: number;
            low: number;
        };
        platform_breakdown: Array<{
            platform: string;
            campaign_count: number;
            percentage: number;
        }>;
        recent_activity: {
            last_24h: {
                new_campaigns: number;
                new_posts: number;
                new_accounts: number;
            };
            last_7d: {
                new_campaigns: number;
                new_posts: number;
                new_accounts: number;
            };
        };
        trend_data: Array<{
            date: string;
            campaigns: number;
            posts: number;
        }>;
    };
    timestamp: string;
}

export interface CampaignsResponse {
    success: boolean;
    data: {
        campaigns: Array<{
            id: string;
            title: string;
            description: string;
            threat_level: string;
            status: string;
            campaign_type: string;
            detected_at: string;
            last_activity: string;
            total_posts: number;
            total_accounts: number;
            reach_estimate: number;
            confidence_score: number;
            threat_score: number;
            growth?: number;
            locations?: Array<{
                lat: number;
                lng: number;
                mentions: number;
            }>;
        }>;
        pagination: {
            current_page: number;
            total_pages: number;
            total_items: number;
            items_per_page: number;
            has_next: boolean;
            has_previous: boolean;
        };
    };
    timestamp: string;
}

export interface CampaignDetailResponse {
    success: boolean;
    data: {
        campaign: {
            id: string;
            title: string;
            description: string;
            threat_level: string;
            status: string;
            campaign_type: string;
            detected_at: string;
            last_activity: string;
            total_posts: number;
            total_accounts: number;
            reach_estimate: number;
            confidence_score: number;
        };
        threat_analysis: {
            campaign_id: string;
            threat_score: number;
            indicators: Array<{
                type: string;
                value: string;
                description: string;
            }>;
            narrative_analysis: string;
            recommendations: string[];
        };
        top_hashtags: Array<{
            tag: string;
            count: number;
        }>;
        platform_breakdown: Array<{
            platform: string;
            post_count: number;
            percentage: number;
        }>;
        timeline: Array<{
            date: string;
            post_count: number;
        }>;
    };
    timestamp: string;
}

export interface CampaignPostsResponse {
    success: boolean;
    data: {
        campaign_id: string;
        campaign_title: string;
        posts: Array<{
            id: string;
            platform: string;
            content: string;
            account_id: string;
            account_username: string;
            posted_at: string;
            engagement_count: number;
            is_flagged: boolean;
            hashtags: string[];
        }>;
        pagination: {
            current_page: number;
            total_pages: number;
            total_items: number;
            items_per_page: number;
            has_next: boolean;
            has_previous: boolean;
        };
    };
    timestamp: string;
}

export interface CampaignAccountsResponse {
    success: boolean;
    data: {
        campaign_id: string;
        campaign_title: string;
        total_accounts: number;
        bot_percentage: number;
        accounts: Array<{
            id: string;
            username: string;
            platform: string;
            account_type: string;
            bot_probability: number;
            post_count_in_campaign: number;
            first_post_at: string;
            last_post_at: string;
        }>;
        network_graph: {
            nodes: Array<{
                id: string;
                label: string;
                type: string;
                size: number;
            }>;
            edges: Array<{
                source: string;
                target: string;
                weight: number;
            }>;
        };
    };
    timestamp: string;
}

export interface ReportsResponse {
    success: boolean;
    data: {
        reports: Array<{
            id: string;
            campaign_id: string | null;
            campaign_title: string | null;
            report_type: string;
            title: string;
            summary: string;
            full_content: string;
            severity: string;
            status: string;
            tags: string[];
            generated_by: string;
            generated_at: string;
            published_at: string;
            views_count: number;
        }>;
        pagination: {
            current_page: number;
            total_pages: number;
            total_items: number;
            items_per_page: number;
            has_next: boolean;
            has_previous: boolean;
        };
    };
    timestamp: string;
}

// API Error class
export class APIError extends Error {
    constructor(public status: number, message: string) {
        super(message);
        this.name = 'APIError';
    }
}

// Generic fetch wrapper with error handling
async function fetchAPI<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;

    try {
        const response = await fetch(url, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...options?.headers,
            },
        });

        if (!response.ok) {
            throw new APIError(
                response.status,
                `API Error: ${response.status} ${response.statusText}`
            );
        }

        const data = await response.json();
        return data as T;
    } catch (error) {
        if (error instanceof APIError) {
            throw error;
        }
        // Network or parsing error
        throw new APIError(0, `Network Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

// Analytics API
export const analyticsAPI = {
    /**
     * Get dashboard overview statistics
     */
    getOverview: async (): Promise<AnalyticsOverviewResponse> => {
        console.log('🔄 Fetching analytics overview from:', `${API_BASE_URL}/api/analytics/overview`);
        const response = await fetchAPI<AnalyticsOverviewResponse>('/api/analytics/overview');
        console.log('✅ Analytics overview received:', response);
        return response;
    },
};

// Campaigns API
export const campaignsAPI = {
    /**
     * Get all campaigns
     */
    getCampaigns: async (): Promise<CampaignsResponse> => {
        console.log('🔄 Fetching campaigns from:', `${API_BASE_URL}/api/campaigns`);
        const response = await fetchAPI<CampaignsResponse>('/api/campaigns');
        console.log('✅ Campaigns received:', response);
        return response;
    },

    /**
     * Get campaign detail
     */
    getCampaignDetail: async (id: string): Promise<CampaignDetailResponse> => {
        console.log(`🔄 Fetching campaign detail (${id}) from:`, `${API_BASE_URL}/api/campaigns/${id}`);
        const response = await fetchAPI<CampaignDetailResponse>(`/api/campaigns/${id}`);
        console.log(`✅ Campaign detail (${id}) received:`, response);
        return response;
    },

    /**
     * Get campaign posts
     */
    getCampaignPosts: async (id: string): Promise<CampaignPostsResponse> => {
        console.log(`🔄 Fetching campaign posts (${id}) from:`, `${API_BASE_URL}/api/campaigns/${id}/posts`);
        const response = await fetchAPI<CampaignPostsResponse>(`/api/campaigns/${id}/posts`);
        console.log(`✅ Campaign posts (${id}) received:`, response);
        return response;
    },

    /**
     * Get campaign accounts
     */
    getCampaignAccounts: async (id: string): Promise<CampaignAccountsResponse> => {
        console.log(`🔄 Fetching campaign accounts (${id}) from:`, `${API_BASE_URL}/api/campaigns/${id}/accounts`);
        const response = await fetchAPI<CampaignAccountsResponse>(`/api/campaigns/${id}/accounts`);
        console.log(`✅ Campaign accounts (${id}) received:`, response);
        return response;
    },

    /**
     * Get geo intelligence data
     */
    getGeoIntelligence: async (): Promise<CampaignsResponse> => {
        console.log('🔄 Fetching geo intelligence from:', `${API_BASE_URL}/api/campaigns?include_geo=true`);
        const response = await fetchAPI<CampaignsResponse>('/api/campaigns?include_geo=true');
        console.log('✅ Geo intelligence received:', response);
        return response;
    },
};

// Reports API
export const reportsAPI = {
    /**
     * Get all intelligence reports
     */
    getReports: async (): Promise<ReportsResponse> => {
        console.log('🔄 Fetching reports from:', `${API_BASE_URL}/api/reports`);
        const response = await fetchAPI<ReportsResponse>('/api/reports');
        console.log('✅ Reports received:', response);
        return response;
    },
};

// Export API base URL for reference
export { API_BASE_URL };
