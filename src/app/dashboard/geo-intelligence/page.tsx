'use client';

import { useEffect, useRef, useState } from 'react';
import { setOptions, importLibrary } from '@googlemaps/js-api-loader';
import { MarkerClusterer } from '@googlemaps/markerclusterer';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { campaignsAPI } from '@/lib/api';
import { Map as MapIcon, Compass, ShieldAlert, Zap, Layers, MapPin, AlertCircle, TrendingUp, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

// India configuration
const INDIA_CENTER = { lat: 20.5937, lng: 78.9629 };
const DEFAULT_ZOOM = 5;

// Types
interface GeoLocation {
    lat: number;
    lng: number;
    mentions: number;
}

interface CampaignGeoData {
    id: string;
    title: string;
    name: string;
    threat_score: number;
    growth?: number;
    locations: GeoLocation[];
}

export default function GeoIntelligencePage() {
    const mapRef = useRef<HTMLDivElement>(null);
    const googleMapRef = useRef<google.maps.Map | null>(null);
    const heatmapRef = useRef<google.maps.visualization.HeatmapLayer | null>(null);
    const markerClustererRef = useRef<MarkerClusterer | null>(null);
    const markersRef = useRef<google.maps.Marker[]>([]);
    const circlesRef = useRef<google.maps.Circle[]>([]);

    const [campaigns, setCampaigns] = useState<CampaignGeoData[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [mapLoaded, setMapLoaded] = useState(false);
    const [showHeatmap, setShowHeatmap] = useState(true);
    const [showMarkers, setShowMarkers] = useState(true);
    const [selectedCampaign, setSelectedCampaign] = useState<CampaignGeoData | null>(null);

    // Initialize Map
    useEffect(() => {
        const initMap = async () => {
            if (!mapRef.current) return;

            try {
                setOptions({
                    key: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '',
                    v: 'weekly',
                    libraries: ['visualization']
                });

                const { Map } = await importLibrary('maps');

                const mapOptions: google.maps.MapOptions = {
                    center: INDIA_CENTER,
                    zoom: DEFAULT_ZOOM,
                    styles: DARK_MAP_STYLE,
                    disableDefaultUI: false,
                    zoomControl: true,
                    mapTypeControl: false,
                    streetViewControl: false,
                    fullscreenControl: true,
                    backgroundColor: '#0a0a0a',
                };

                const map = new Map(mapRef.current, mapOptions);
                googleMapRef.current = map;
                setMapLoaded(true);

                // Fetch data after map is ready
                fetchData();
            } catch (err) {
                console.error('❌ Failed to load Google Maps:', err);
                setError('Failed to load Google Maps API. Check your API key and connection.');
                setIsLoading(false);
            }
        };

        if (typeof window !== 'undefined') {
            initMap();
        }
    }, []);

    const fetchData = async () => {
        try {
            setIsLoading(true);
            const response = await campaignsAPI.getGeoIntelligence();

            // Filter only if they have locations
            const data = response.data.campaigns.filter(c => c.locations && c.locations.length > 0) as unknown as CampaignGeoData[];

            if (data.length === 0) {
                setError('No geographic intelligence available.');
            } else {
                setCampaigns(data);
                updateMapElements(data);
            }
        } catch (err) {
            console.error('❌ Error fetching geo data:', err);
            setError('Failed to fetch campaign intelligence data.');
        } finally {
            setIsLoading(false);
        }
    };

    const updateMapElements = (data: CampaignGeoData[]) => {
        if (!googleMapRef.current) return;

        // Clear existing elements
        markersRef.current.forEach(m => m.setMap(null));
        markersRef.current = [];

        if (markerClustererRef.current) {
            markerClustererRef.current.clearMarkers();
        }

        circlesRef.current.forEach(c => c.setMap(null));
        circlesRef.current = [];

        if (heatmapRef.current) {
            heatmapRef.current.setMap(null);
        }

        const heatmapData: google.maps.visualization.WeightedLocation[] = [];
        const markers: google.maps.Marker[] = [];

        data.forEach(campaign => {
            const color = getThreatColor(campaign.threat_score);
            const isCritical = campaign.threat_score >= 70;
            const isSurging = campaign.growth && campaign.growth > 40;

            campaign.locations.forEach(loc => {
                // Add to heatmap
                heatmapData.push({
                    location: new google.maps.LatLng(loc.lat, loc.lng),
                    weight: loc.mentions
                });

                // Add marker
                const marker = new google.maps.Marker({
                    position: { lat: loc.lat, lng: loc.lng },
                    map: showMarkers ? googleMapRef.current : null,
                    title: campaign.title,
                    icon: {
                        path: google.maps.SymbolPath.CIRCLE,
                        fillColor: color,
                        fillOpacity: 0.8,
                        strokeWeight: 2,
                        strokeColor: '#ffffff',
                        scale: 8 + (Math.log10(loc.mentions) * 2)
                    }
                });

                const infoWindow = new google.maps.InfoWindow({
                    content: `
                        <div style="color: #000; padding: 10px; min-width: 150px;">
                            <h3 style="margin: 0 0 5px; font-weight: bold; font-size: 14px;">${campaign.title}</h3>
                            <div style="display: flex; justify-between: space-between; margin-bottom: 5px;">
                                <span style="color: #666; font-size: 12px;">Threat Score:</span>
                                <span style="font-weight: bold; color: ${color}; font-size: 12px;">${campaign.threat_score}</span>
                            </div>
                            <div style="display: flex; justify-between: space-between;">
                                <span style="color: #666; font-size: 12px;">Mentions:</span>
                                <span style="font-weight: bold; font-size: 12px;">${loc.mentions}</span>
                            </div>
                            ${isSurging ? '<div style="margin-top: 5px; font-weight: bold; color: #ff0000; font-size: 10px; border: 1px solid #ff0000; padding: 2px;">SURGE DETECTED (+' + campaign.growth + '%)</div>' : ''}
                        </div>
                    `
                });

                marker.addListener('click', () => {
                    infoWindow.open(googleMapRef.current, marker);
                    setSelectedCampaign(campaign);
                });

                markers.push(marker);
                markersRef.current.push(marker);

                // Add surge animation (circle overlay)
                if (isSurging) {
                    const circle = new google.maps.Circle({
                        strokeColor: '#FF0000',
                        strokeOpacity: 0.8,
                        strokeWeight: 2,
                        fillColor: '#FF0000',
                        fillOpacity: 0.1,
                        map: googleMapRef.current,
                        center: { lat: loc.lat, lng: loc.lng },
                        radius: 50000 // 50km
                    });

                    // Simple pulse animation
                    let direction = 1;
                    setInterval(() => {
                        const currentOpacity = circle.get('fillOpacity');
                        let nextOpacity = currentOpacity + (0.01 * direction);
                        if (nextOpacity > 0.3 || nextOpacity < 0.05) {
                            direction *= -1;
                        }
                        circle.setOptions({ fillOpacity: nextOpacity });
                    }, 100);

                    circlesRef.current.push(circle);
                }
            });
        });

        // Initialize clustering
        if (showMarkers) {
            markerClustererRef.current = new MarkerClusterer({
                map: googleMapRef.current!,
                markers: markers
            });
        }

        // Initialize Heatmap
        const heatmap = new google.maps.visualization.HeatmapLayer({
            data: heatmapData,
            map: showHeatmap ? googleMapRef.current : null,
            radius: 40,
            opacity: 0.7
        });
        heatmapRef.current = heatmap;
    };

    const getThreatColor = (score: number) => {
        if (score < 40) return '#00FF41'; // Green
        if (score < 70) return '#FFD700'; // Yellow/Gold
        return '#FF0000'; // Red
    };

    const toggleHeatmap = () => {
        const next = !showHeatmap;
        setShowHeatmap(next);
        if (heatmapRef.current) {
            heatmapRef.current.setMap(next ? googleMapRef.current : null);
        }
    };

    const toggleMarkers = () => {
        const next = !showMarkers;
        setShowMarkers(next);
        if (markerClustererRef.current) {
            if (next) {
                markerClustererRef.current.setMap(googleMapRef.current);
            } else {
                markerClustererRef.current.setMap(null);
            }
        }
    };

    return (
        <div className="flex flex-col gap-6 h-[calc(100vh-120px)]">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 shrink-0">
                <div>
                    <h1 className="text-3xl font-bold text-foreground mb-1.5 tracking-tight group flex items-center gap-3">
                        Geo-Intelligence Mapping
                        <div className="h-2 w-2 rounded-full bg-secondary animate-pulse" />
                    </h1>
                    <p className="text-text-muted text-sm flex items-center gap-2 font-medium">
                        Real-time campaign spatial distribution and surge detection across India.
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button
                        variant={showMarkers ? "primary" : "outline"}
                        size="sm"
                        onClick={toggleMarkers}
                        className="font-bold text-[10px] tracking-widest gap-2"
                    >
                        <MapPin className="w-3.5 h-3.5" />
                        MARKERS {showMarkers ? 'ON' : 'OFF'}
                    </Button>
                    <Button
                        variant={showHeatmap ? "primary" : "outline"}
                        size="sm"
                        onClick={toggleHeatmap}
                        className="font-bold text-[10px] tracking-widest gap-2"
                    >
                        <Layers className="w-3.5 h-3.5" />
                        HEATMAP {showHeatmap ? 'ON' : 'OFF'}
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={fetchData}
                        className="font-bold text-[10px] tracking-widest gap-2"
                    >
                        <Zap className="w-3.5 h-3.5" />
                        REFRESH
                    </Button>
                </div>
            </div>

            {/* Main Map Area */}
            <div className="flex-1 flex gap-6 overflow-hidden">
                <Card className="flex-1 relative overflow-hidden p-0 border-border bg-[#0a0a0a] shadow-2xl" noPadding>
                    <div ref={mapRef} className="w-full h-full" />

                    {isLoading && (
                        <div className="absolute inset-0 bg-background/50 backdrop-blur-sm flex items-center justify-center z-10">
                            <div className="flex flex-col items-center gap-4">
                                <motion.div
                                    animate={{ rotate: 360 }}
                                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                                    className="p-3 rounded-full border-b-2 border-primary"
                                >
                                    <Compass className="w-8 h-8 text-primary" />
                                </motion.div>
                                <p className="text-sm font-mono text-primary animate-pulse tracking-widest">INITIALIZING GEO-ENGINE...</p>
                            </div>
                        </div>
                    )}

                    {error && (
                        <div className="absolute inset-0 bg-background/80 backdrop-blur-md flex items-center justify-center z-20 p-6">
                            <div className="max-w-md text-center flex flex-col items-center gap-4">
                                <div className="p-4 rounded-full bg-risk-high/10 text-risk-high shadow-[0_0_20px_rgba(255,0,0,0.2)]">
                                    <ShieldAlert className="w-12 h-12" />
                                </div>
                                <h3 className="text-xl font-bold text-foreground">Analysis Error</h3>
                                <p className="text-text-muted">{error}</p>
                                <Button variant="primary" onClick={fetchData}>RETRY ANALYSIS</Button>
                            </div>
                        </div>
                    )}

                    {/* Legend */}
                    {!isLoading && !error && (
                        <div className="absolute bottom-6 left-6 p-4 bg-surface/80 backdrop-blur-md border border-border rounded-lg shadow-xl pointer-events-none z-10 min-w-[200px]">
                            <p className="text-[10px] font-mono text-text-muted uppercase tracking-[0.2em] mb-3">Threat Matrix</p>
                            <div className="space-y-2">
                                <div className="flex items-center gap-3">
                                    <div className="w-3 h-3 rounded-full bg-risk-high shadow-[0_0_8px_rgba(255,0,0,0.5)]" />
                                    <span className="text-xs font-bold text-foreground uppercase tracking-tight">High Risk (70+)</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="w-3 h-3 rounded-full bg-[#FFD700] shadow-[0_0_8px_rgba(255,215,0,0.5)]" />
                                    <span className="text-xs font-bold text-foreground uppercase tracking-tight">Medium Risk (40-70)</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="w-3 h-3 rounded-full bg-primary shadow-[0_0_8px_rgba(0,255,65,0.5)]" />
                                    <span className="text-xs font-bold text-foreground uppercase tracking-tight">Low Risk (&lt;40)</span>
                                </div>
                                <div className="flex items-center gap-3 mt-2 border-t border-border pt-2">
                                    <div className="w-3 h-3 rounded-full border-2 border-risk-high animate-ping" />
                                    <span className="text-[10px] font-bold text-risk-high uppercase tracking-widest">Surge Detected</span>
                                </div>
                            </div>
                        </div>
                    )}
                </Card>

                {/* Info Sidebar */}
                <div className="hidden lg:flex flex-col gap-6 w-80 overflow-y-auto">
                    <Card className="border-l-4 border-l-secondary">
                        <div className="flex items-center gap-2 mb-4">
                            <TrendingUp className="w-4 h-4 text-secondary" />
                            <h3 className="text-xs font-mono font-bold tracking-widest uppercase text-secondary">Spatial Metrics</h3>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <p className="text-[10px] text-text-muted mb-1 font-mono">ACTIVE CLUSTERS</p>
                                <p className="text-2xl font-bold font-mono">{campaigns.length}</p>
                            </div>
                            <div>
                                <p className="text-[10px] text-text-muted mb-1 font-mono">PRIMARY HOTSPOT</p>
                                <p className="text-sm font-bold truncate">Delhi NCR Region</p>
                            </div>
                            <div>
                                <p className="text-[10px] text-text-muted mb-1 font-mono">SURGE INTENSITY</p>
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-bold text-risk-high">+45.2%</span>
                                    <div className="h-1.5 flex-1 bg-border rounded-full overflow-hidden">
                                        <div className="h-full bg-risk-high w-3/4 shadow-[0_0_8px_rgba(255,0,0,0.5)]" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </Card>

                    <Card className="flex-1 overflow-visible">
                        <div className="flex items-center gap-2 mb-4">
                            <Info className="w-4 h-4 text-primary" />
                            <h3 className="text-xs font-mono font-bold tracking-widest uppercase text-primary">Active Hotspots</h3>
                        </div>
                        <div className="space-y-3">
                            <AnimatePresence>
                                {campaigns.map((camp, idx) => (
                                    <motion.div
                                        key={camp.id}
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: idx * 0.1 }}
                                        className={cn(
                                            "p-3 rounded-md bg-surface-highlight/30 border border-border cursor-pointer hover:border-primary/50 transition-all group",
                                            selectedCampaign?.id === camp.id && "border-primary/50 bg-primary/5"
                                        )}
                                        onClick={() => {
                                            setSelectedCampaign(camp);
                                            if (googleMapRef.current && camp.locations[0]) {
                                                googleMapRef.current.panTo({ lat: camp.locations[0].lat, lng: camp.locations[0].lng });
                                                googleMapRef.current.setZoom(8);
                                            }
                                        }}
                                    >
                                        <div className="flex justify-between items-start mb-1">
                                            <p className="text-xs font-bold truncate pr-2 tracking-tight group-hover:text-primary">{camp.title}</p>
                                            <span className={cn(
                                                "text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border",
                                                camp.threat_score >= 70 ? "text-risk-high border-risk-high/30 bg-risk-high/5" :
                                                    camp.threat_score >= 40 ? "text-[#FFD700] border-[#FFD700]/30 bg-[#FFD700]/5" :
                                                        "text-primary border-primary/30 bg-primary/5"
                                            )}>
                                                {camp.threat_score}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2 text-[10px] text-text-muted">
                                            <MapPin className="w-3 h-3" />
                                            <span>{camp.locations.length} coordinates</span>
                                            {camp.growth && camp.growth > 40 && (
                                                <span className="ml-auto text-risk-high animate-pulse">SURGING</span>
                                            )}
                                        </div>
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    );
}

// Minimal Dark Map Style
const DARK_MAP_STYLE = [
    { "elementType": "geometry", "stylers": [{ "color": "#121212" }] },
    { "elementType": "labels.text.stroke", "stylers": [{ "color": "#121212" }] },
    { "elementType": "labels.text.fill", "stylers": [{ "color": "#444444" }] },
    { "featureType": "administrative.locality", "elementType": "labels.text.fill", "stylers": [{ "color": "#777777" }] },
    { "featureType": "poi", "elementType": "labels.text.fill", "stylers": [{ "color": "#444444" }] },
    { "featureType": "poi.park", "elementType": "geometry", "stylers": [{ "color": "#0a0a0a" }] },
    { "featureType": "road", "elementType": "geometry", "stylers": [{ "color": "#1a1a1a" }] },
    { "featureType": "road", "elementType": "geometry.stroke", "stylers": [{ "color": "#222222" }] },
    { "featureType": "road", "elementType": "labels.text.fill", "stylers": [{ "color": "#555555" }] },
    { "featureType": "road.highway", "elementType": "geometry", "stylers": [{ "color": "#1f1f1f" }] },
    { "featureType": "road.highway", "elementType": "geometry.stroke", "stylers": [{ "color": "#2a2a2a" }] },
    { "featureType": "water", "elementType": "geometry", "stylers": [{ "color": "#0a0a0a" }] },
    { "featureType": "water", "elementType": "labels.text.fill", "stylers": [{ "color": "#222222" }] },
    { "featureType": "water", "elementType": "labels.text.stroke", "stylers": [{ "color": "#0a0a0a" }] }
];
