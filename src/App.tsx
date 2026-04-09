import React, { useState, useEffect } from 'react';
import { 
  Terminal, 
  Link as LinkIcon, 
  Activity, 
  Globe, 
  Settings, 
  Copy, 
  Check, 
  AlertCircle,
  ExternalLink,
  Monitor,
  Shield,
  Cpu,
  LogOut
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface LogEntry {
  timestamp: string;
  ipAddress: string;
  location: string;
  isp: string;
  lat: number;
  lon: number;
  device: string;
  browser: string;
  id: string;
  fingerprint?: {
    screen: string;
    timezone: string;
    language: string;
    platform: string;
  };
}

// Tactical Map Component using D3
import * as d3 from 'd3';
import * as topojson from 'topojson-client';

const TacticalMap = ({ logs }: { logs: LogEntry[] }) => {
  const svgRef = React.useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    const width = 800;
    const height = 400;

    // Clear previous content
    svg.selectAll("*").remove();

    const projection = d3.geoMercator()
      .scale(120)
      .translate([width / 2, height / 1.5]);

    const path = d3.geoPath().projection(projection);

    // Load world data
    d3.json("https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json").then((data: any) => {
      const countries = topojson.feature(data, data.objects.countries) as any;

      // Draw countries
      svg.append("g")
        .selectAll("path")
        .data(countries.features)
        .enter()
        .append("path")
        .attr("d", path)
        .attr("fill", "#1a1a1a")
        .attr("stroke", "#353534")
        .attr("stroke-width", 0.5);

      // Draw points for logs
      const points = logs.filter(l => l.lat !== 0 && l.lon !== 0);
      
      svg.append("g")
        .selectAll("circle")
        .data(points)
        .enter()
        .append("circle")
        .attr("cx", d => projection([d.lon, d.lat])![0])
        .attr("cy", d => projection([d.lon, d.lat])![1])
        .attr("r", 4)
        .attr("fill", "#00ff41")
        .attr("class", "pulse-point")
        .append("title")
        .text(d => `${d.ipAddress} - ${d.location}`);

      // Add pulse effect
      svg.selectAll(".pulse-point")
        .each(function() {
          const circle = d3.select(this);
          (function repeat() {
            circle
              .transition()
              .duration(2000)
              .attr("r", 8)
              .attr("opacity", 0)
              .transition()
              .duration(0)
              .attr("r", 4)
              .attr("opacity", 1)
              .on("end", repeat);
          })();
        });
    });
  }, [logs]);

  return (
    <div className="relative w-full aspect-[2/1] bg-[#0e0e0e] border border-[#353534]/20 overflow-hidden">
      <div className="absolute top-2 left-2 z-10 flex items-center gap-2 px-2 py-1 bg-[#131313]/80 border border-[#00ff41]/20 text-[10px] uppercase tracking-widest text-[#00ff41]">
        <Globe className="w-3 h-3 animate-spin-slow" />
        GLOBAL_THREAT_MAP
      </div>
      <svg
        ref={svgRef}
        viewBox="0 0 800 400"
        className="w-full h-full"
        style={{ filter: 'drop-shadow(0 0 10px rgba(0, 255, 65, 0.1))' }}
      />
      {/* Map Overlay Stats */}
      <div className="absolute bottom-4 left-4 space-y-1 bg-[#131313]/60 p-2 border-l border-[#00ff41]">
        <div className="text-[10px] opacity-60 uppercase">ACTIVE_SESSIONS: <span className="text-[#00ff41]">{logs.length}</span></div>
        <div className="text-[10px] opacity-60 uppercase">GLOBAL_TRAFFIC: <span className="text-[#00ff41]">1.2 GB/S</span></div>
        <div className="text-[10px] opacity-60 uppercase">ALERT_STATUS: <span className="text-[#00ff41]">NOMINAL</span></div>
      </div>
    </div>
  );
};

export default function App() {
  const [targetUrl, setTargetUrl] = useState('');
  const [generatedLink, setGeneratedLink] = useState('');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const [analysisResults, setAnalysisResults] = useState<Record<string, string>>({});

  // Poll logs every 5 seconds
  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const response = await fetch('/api/logs');
        if (response.ok) {
          const data = await response.json();
          setLogs(data);
        }
      } catch (error) {
        console.error('Failed to fetch logs:', error);
      }
    };

    fetchLogs();
    const interval = setInterval(fetchLogs, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleAnalyze = async (log: LogEntry, index: number) => {
    const key = `${log.id}-${log.timestamp}`;
    setAnalyzingId(key);
    try {
      const response = await fetch('/api/analyze-threat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logEntry: log }),
      });
      if (response.ok) {
        const data = await response.json();
        setAnalysisResults(prev => ({ ...prev, [key]: data.analysis }));
      } else {
        setAnalysisResults(prev => ({ ...prev, [key]: "ERROR: AI Analysis failed. Check API Key." }));
      }
    } catch (error) {
      console.error('Analysis failed:', error);
    } finally {
      setAnalyzingId(null);
    }
  };

  const handleGenerate = async () => {
    if (!targetUrl) return;
    setIsGenerating(true);
    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUrl }),
      });
      if (response.ok) {
        const data = await response.json();
        setGeneratedLink(data.trackingUrl);
      }
    } catch (error) {
      console.error('Generation failed:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatedLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleLogout = () => {
    if (window.confirm("TERMINATE SESSION?")) {
      window.location.reload();
    }
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column: Generator */}
            <div className="lg:col-span-2 space-y-8">
              <section className="bg-[#0e0e0e] border border-[#353534]/20 p-6 relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-1 h-full bg-[#00ff41]" />
                <h2 className="text-lg font-bold mb-6 flex items-center gap-2">
                  <span className="w-2 h-2 bg-[#00ff41]" />
                  LINK_GENERATOR_MODULE
                </h2>

                <div className="space-y-6">
                  <div>
                    <label className="block text-xs uppercase opacity-50 mb-2 tracking-widest">
                      [TARGET_DESTINATION_URL]
                    </label>
                    <input 
                      type="text" 
                      value={targetUrl}
                      onChange={(e) => setTargetUrl(e.target.value)}
                      placeholder="https://target-destination.com/resource"
                      className="w-full bg-[#131313] border border-[#353534]/40 px-4 py-3 focus:border-[#00ff41] focus:outline-none transition-colors"
                    />
                  </div>

                  <button 
                    onClick={handleGenerate}
                    disabled={isGenerating || !targetUrl}
                    className="w-full bg-[#00ff41] text-[#003907] py-4 font-bold uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-[#00ff41]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
                  >
                    {isGenerating ? (
                      <div className="w-5 h-5 border-2 border-[#003907] border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <LinkIcon className="w-5 h-5" />
                        GENERATE_TRACKING_LINK
                      </>
                    )}
                  </button>

                  <AnimatePresence>
                    {generatedLink && (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-2"
                      >
                        <label className="block text-xs uppercase opacity-50 mb-2 tracking-widest">
                          ENCRYPTED_URL
                        </label>
                        <div className="flex gap-2">
                          <div className="flex-1 bg-[#131313] border border-[#00ff41]/30 px-4 py-3 text-[#00ff41] break-all">
                            {generatedLink}
                          </div>
                          <button 
                            onClick={copyToClipboard}
                            className="bg-[#353534]/20 border border-[#353534]/40 px-4 hover:bg-[#353534]/40 transition-colors"
                          >
                            {copied ? <Check className="w-5 h-5 text-[#00ff41]" /> : <Copy className="w-5 h-5" />}
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </section>
              
              {/* Tactical Map Visualization */}
              <TacticalMap logs={logs} />
            </div>

            {/* Right Column: Parameters & Stats */}
            <div className="space-y-8">
              <section className="bg-[#0e0e0e] border border-[#353534]/20 p-6">
                <h2 className="text-lg font-bold mb-6 uppercase tracking-tight">REDIRECTION_PARAMETERS</h2>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-[#131313] border border-[#353534]/40">
                    <span className="text-xs uppercase opacity-60">SPOOF_REFERRER</span>
                    <div className="w-4 h-4 bg-[#00ff41] flex items-center justify-center">
                      <Check className="w-3 h-3 text-[#003907]" />
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-[#131313] border border-[#353534]/40">
                    <span className="text-xs uppercase opacity-60">INJECT_JS_FINGERPRINT</span>
                    <div className="w-4 h-4 bg-[#00ff41] flex items-center justify-center">
                      <Check className="w-3 h-3 text-[#003907]" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase opacity-40 mb-2">DELAY_REDIRECT (ms)</label>
                    <div className="bg-[#131313] border border-[#353534]/40 p-3 text-[#00ff41]">
                      1500
                    </div>
                  </div>
                </div>
                
                <div className="mt-8 p-4 border border-[#00ff41]/20 bg-[#00ff41]/5 text-[10px] space-y-1">
                  <p className="text-[#00ff41]">[!] STEALTH_MODE: ACTIVE</p>
                  <p className="opacity-60">[!] ENCRYPTION: AES-256-GCM</p>
                  <p className="opacity-60">[!] LOG_RETENTION: 24H</p>
                </div>
              </section>

              <section className="bg-[#0e0e0e] border border-[#353534]/20 p-6">
                <h2 className="text-lg font-bold mb-6 uppercase tracking-tight">SYSTEM_TELEMETRY</h2>
                <div className="space-y-6">
                  <div className="space-y-2">
                    <div className="flex justify-between text-[10px] uppercase opacity-60">
                      <span>ACTIVE_SESSIONS</span>
                      <span>{logs.length}</span>
                    </div>
                    <div className="h-1 bg-[#353534]/40">
                      <div className="h-full bg-[#00ff41]" style={{ width: `${Math.min(logs.length * 10, 100)}%` }} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-[10px] uppercase opacity-60">
                      <span>GLOBAL_TRAFFIC</span>
                      <span>1.2 GB/S</span>
                    </div>
                    <div className="h-1 bg-[#353534]/40">
                      <div className="h-full bg-[#00ff41] w-[42%]" />
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 border border-yellow-500/20 bg-yellow-500/5">
                    <AlertCircle className="w-5 h-5 text-yellow-500" />
                    <div className="text-[10px] uppercase">
                      <p className="text-yellow-500 font-bold">ALERT_STATUS: NOMINAL</p>
                      <p className="opacity-60">NO BREACHES DETECTED</p>
                    </div>
                  </div>
                </div>
              </section>
            </div>
          </div>
        );
      case 'logs':
        return (
          <section className="bg-[#0e0e0e] border border-[#353534]/20 p-6 relative">
            <div className="absolute top-0 left-0 w-1 h-full bg-[#00ff41]" />
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <span className="w-2 h-2 bg-[#00ff41]" />
                LIVE_TARGETS_LOG
              </h2>
              <div className="text-[10px] opacity-40 uppercase tracking-tighter">
                TOTAL_RECORDS: {logs.length}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="text-[10px] uppercase tracking-widest opacity-40 border-b border-[#353534]/20">
                    <th className="py-4 font-normal">[TIMESTAMP]</th>
                    <th className="py-4 font-normal">[IP_ADDRESS / ISP]</th>
                    <th className="py-4 font-normal">[APPROX_LOCATION / TZ]</th>
                    <th className="py-4 font-normal">[DEVICE / SCREEN]</th>
                    <th className="py-4 font-normal">[STATUS]</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {logs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center opacity-30 italic">
                        WAITING FOR INCOMING TRANSMISSIONS...
                      </td>
                    </tr>
                  ) : (
                      <React.Fragment key={i}>
                        <motion.tr 
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          className="border-b border-[#353534]/10 hover:bg-[#00ff41]/5 transition-colors group"
                        >
                          <td className="py-4 opacity-60">
                            {new Date(log.timestamp).toLocaleTimeString()}
                            <div className="text-[10px] opacity-40">{new Date(log.timestamp).toLocaleDateString()}</div>
                          </td>
                          <td className="py-4">
                            <div className="text-[#00ff41] font-bold">{log.ipAddress}</div>
                            <div className="text-[10px] opacity-50 truncate max-w-[150px]">{log.isp}</div>
                          </td>
                          <td className="py-4">
                            <div>{log.location}</div>
                            {log.fingerprint?.timezone && (
                              <div className="text-[10px] text-yellow-500/70 flex items-center gap-1">
                                <Globe className="w-3 h-3" /> {log.fingerprint.timezone}
                              </div>
                            )}
                          </td>
                          <td className="py-4">
                            <div className="opacity-60">{log.device}</div>
                            {log.fingerprint?.screen && (
                              <div className="text-[10px] opacity-40 flex items-center gap-1">
                                <Monitor className="w-3 h-3" /> {log.fingerprint.screen}
                              </div>
                            )}
                          </td>
                          <td className="py-4">
                            <div className="flex flex-col gap-2">
                              <span className="px-2 py-0.5 bg-[#00ff41]/10 text-[#00ff41] text-[10px] border border-[#00ff41]/20 w-fit">
                                {log.fingerprint ? 'VERIFIED' : 'ACTIVE'}
                              </span>
                              <button 
                                onClick={() => handleAnalyze(log, i)}
                                disabled={analyzingId === `${log.id}-${log.timestamp}`}
                                className="text-[10px] uppercase text-[#00ff41] hover:underline flex items-center gap-1 disabled:opacity-50"
                              >
                                {analyzingId === `${log.id}-${log.timestamp}` ? (
                                  <div className="w-2 h-2 border border-[#00ff41] border-t-transparent rounded-full animate-spin" />
                                ) : (
                                  <Cpu className="w-3 h-3" />
                                )}
                                AI_ANALYZE
                              </button>
                            </div>
                          </td>
                        </motion.tr>
                        {analysisResults[`${log.id}-${log.timestamp}`] && (
                          <tr className="bg-[#00ff41]/5 border-b border-[#353534]/10">
                            <td colSpan={5} className="py-3 px-4">
                              <div className="text-[10px] text-[#00ff41] leading-relaxed font-mono">
                                {analysisResults[`${log.id}-${log.timestamp}`]}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        );
      case 'map':
        return (
          <div className="space-y-8">
            <TacticalMap logs={logs} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <section className="bg-[#0e0e0e] border border-[#353534]/20 p-6">
                <h3 className="text-sm font-bold mb-4 uppercase text-[#00ff41]">GEO_DISTRIBUTION</h3>
                <div className="space-y-2">
                  {Array.from(new Set(logs.map(l => l.location.split(',').pop()?.trim()))).slice(0, 5).map((country, i) => (
                    <div key={i} className="flex justify-between text-xs">
                      <span className="opacity-60">{country || 'UNKNOWN'}</span>
                      <span className="text-[#00ff41]">{logs.filter(l => l.location.includes(country || '')).length}</span>
                    </div>
                  ))}
                </div>
              </section>
              <section className="bg-[#0e0e0e] border border-[#353534]/20 p-6">
                <h3 className="text-sm font-bold mb-4 uppercase text-[#00ff41]">SIGNAL_STRENGTH</h3>
                <div className="flex items-end gap-1 h-24">
                  {[40, 70, 45, 90, 65, 80, 55, 30, 85, 60].map((h, i) => (
                    <div key={i} className="flex-1 bg-[#00ff41]/20 relative group">
                      <div className="absolute bottom-0 left-0 w-full bg-[#00ff41] transition-all duration-500" style={{ height: `${h}%` }} />
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </div>
        );
      case 'settings':
        return (
          <div className="max-w-2xl space-y-8">
            <section className="bg-[#0e0e0e] border border-[#353534]/20 p-6">
              <h2 className="text-lg font-bold mb-6 uppercase tracking-tight text-[#00ff41]">SYSTEM_CONFIGURATION</h2>
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-xs uppercase opacity-50">API_ENDPOINT_OVERRIDE</label>
                  <input type="text" readOnly value={window.location.origin} className="w-full bg-[#131313] border border-[#353534]/40 p-3 text-sm opacity-60" />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs uppercase opacity-60">AUTO_REFRESH_LOGS</span>
                  <div className="w-12 h-6 bg-[#00ff41]/20 border border-[#00ff41]/40 relative cursor-pointer">
                    <div className="absolute right-1 top-1 w-4 h-4 bg-[#00ff41]" />
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs uppercase opacity-60">ENCRYPT_LOCAL_STORAGE</span>
                  <div className="w-12 h-6 bg-[#131313] border border-[#353534]/40 relative cursor-pointer">
                    <div className="absolute left-1 top-1 w-4 h-4 bg-[#353534]" />
                  </div>
                </div>
              </div>
            </section>

            <section className="bg-[#0e0e0e] border border-[#353534]/20 p-6">
              <h2 className="text-lg font-bold mb-6 uppercase tracking-tight text-red-500">DANGER_ZONE</h2>
              <button className="w-full border border-red-500/40 text-red-500 py-3 text-xs uppercase hover:bg-red-500/10 transition-colors">
                PURGE_ALL_TRANSMISSION_LOGS
              </button>
            </section>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-[#131313] text-[#ebffe2] font-mono selection:bg-[#00ff41] selection:text-[#003907] relative overflow-hidden">
      {/* Scanline Overlay */}
      <div className="fixed inset-0 pointer-events-none z-50 opacity-[0.03] bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_2px,3px_100%]" />
      
      {/* Grid Overlay */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.05]" 
           style={{ backgroundImage: 'radial-gradient(#00ff41 0.5px, transparent 0.5px)', backgroundSize: '24px 24px' }} />

      {/* Sidebar */}
      <aside className="fixed left-0 top-0 bottom-0 w-16 bg-[#0e0e0e] border-r border-[#353534]/20 flex flex-col items-center py-8 z-40">
        <div className="mb-12">
          <Shield className="w-8 h-8 text-[#00ff41]" />
        </div>
        
        <nav className="flex flex-col gap-8">
          <button 
            onClick={() => setActiveTab('dashboard')}
            title="DASHBOARD"
            className={`p-2 transition-colors ${activeTab === 'dashboard' ? 'bg-[#00ff41] text-[#003907]' : 'text-[#ebffe2] hover:text-[#00ff41]'}`}
          >
            <Terminal className="w-6 h-6" />
          </button>
          <button 
            onClick={() => setActiveTab('logs')}
            title="TRANSMISSION_LOGS"
            className={`p-2 transition-colors ${activeTab === 'logs' ? 'bg-[#00ff41] text-[#003907]' : 'text-[#ebffe2] hover:text-[#00ff41]'}`}
          >
            <Activity className="w-6 h-6" />
          </button>
          <button 
            onClick={() => setActiveTab('map')}
            title="GLOBAL_MAP"
            className={`p-2 transition-colors ${activeTab === 'map' ? 'bg-[#00ff41] text-[#003907]' : 'text-[#ebffe2] hover:text-[#00ff41]'}`}
          >
            <Globe className="w-6 h-6" />
          </button>
          <button 
            onClick={() => setActiveTab('settings')}
            title="SYSTEM_SETTINGS"
            className={`p-2 transition-colors ${activeTab === 'settings' ? 'bg-[#00ff41] text-[#003907]' : 'text-[#ebffe2] hover:text-[#00ff41]'}`}
          >
            <Settings className="w-6 h-6" />
          </button>
        </nav>

        <div className="mt-auto">
          <button 
            onClick={handleLogout}
            title="TERMINATE_SESSION"
            className="p-2 text-[#ebffe2] hover:text-red-500 transition-colors"
          >
            <LogOut className="w-6 h-6" />
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="pl-16 min-h-screen">
        {/* Header */}
        <header className="h-16 border-b border-[#353534]/20 flex items-center px-8 justify-between bg-[#131313]/80 backdrop-blur-md sticky top-0 z-30">
          <div className="flex items-center gap-4">
            <div className="w-2 h-2 bg-[#00ff41] rounded-full animate-pulse" />
            <h1 className="text-xl font-bold tracking-tighter uppercase">
              PINPOINT // {activeTab.toUpperCase()}_VIEW
            </h1>
          </div>
          <div className="flex items-center gap-6 text-sm opacity-60">
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4" />
              <span>SYS_LOAD: 12%</span>
            </div>
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4" />
              <span>UPTIME: 14D 02H 44M</span>
            </div>
          </div>
        </header>

        <div className="p-8 max-w-7xl mx-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {renderContent()}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* Footer */}
      <footer className="pl-16 h-12 border-t border-[#353534]/20 flex items-center px-8 justify-between text-[10px] opacity-40 uppercase tracking-widest bg-[#0e0e0e]">
        <div>© 2024 PINPOINT_OS // ENCRYPTED_TRANSMISSION</div>
        <div className="flex gap-6">
          <span className="text-[#00ff41]">STATUS_OK</span>
          <span className="cursor-pointer hover:text-[#00ff41]" onClick={() => setActiveTab('settings')}>MANUAL</span>
          <span className="cursor-pointer hover:text-[#00ff41]" onClick={() => setActiveTab('settings')}>API_DOCS</span>
          <span className="cursor-pointer hover:text-[#00ff41]" onClick={() => setActiveTab('settings')}>SUPPORT</span>
        </div>
      </footer>
    </div>
  );
}
