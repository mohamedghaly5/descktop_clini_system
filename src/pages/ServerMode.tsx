import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
    Server,
    ShieldCheck,
    Activity,
    Power,
    Wifi,
    Copy,
    Check,
    AlertTriangle,
    XCircle,
    RefreshCw,
    Database,
    Globe,
    CheckCircle2,
    Loader2
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { useNavigate } from 'react-router-dom';
import { Badge } from "@/components/ui/badge";

interface HealthStatus {
    api: 'checking' | 'online' | 'offline' | 'error';
    database: 'checking' | 'connected' | 'disconnected' | 'error';
    network: 'checking' | 'accessible' | 'blocked' | 'unknown';
    apiError?: string;
    dbError?: string;
    networkError?: string;
}

const ServerMode: React.FC = () => {
    const navigate = useNavigate();
    const [uptime, setUptime] = useState(0);
    const [serverStartTime, setServerStartTime] = useState<number>(0);
    const [ip, setIp] = useState('');
    const [port, setPort] = useState(3000);
    const [copiedField, setCopiedField] = useState<string | null>(null);
    const [isCheckingHealth, setIsCheckingHealth] = useState(false);
    const [lastHealthCheck, setLastHealthCheck] = useState<Date | null>(null);

    const [health, setHealth] = useState<HealthStatus>({
        api: 'checking',
        database: 'checking',
        network: 'checking'
    });

    const copyToClipboard = (text: string, field: string) => {
        navigator.clipboard.writeText(text);
        setCopiedField(field);
        setTimeout(() => setCopiedField(null), 2000);
    };

    // Check server health via API
    const checkServerHealth = async () => {
        setIsCheckingHealth(true);
        const newHealth: HealthStatus = {
            api: 'checking',
            database: 'checking',
            network: 'checking'
        };

        // Determine the base URL - try 127.0.0.1 first (safer than localhost on offline networks)
        const localUrl = `http://127.0.0.1:${port}`;
        const externalUrl = ip && port ? `http://${ip}:${port}` : localUrl;

        try {
            // 1. Check API Health using new /api/health endpoint
            const healthCheck = await fetch(`${localUrl}/api/health`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' },
                signal: AbortSignal.timeout(5000)
            });

            if (healthCheck.ok) {
                const healthData = await healthCheck.json();
                newHealth.api = 'online';

                // Check database status from health response
                if (healthData.services?.database?.status === 'connected') {
                    newHealth.database = 'connected';
                } else if (healthData.services?.database?.status === 'error') {
                    newHealth.database = 'error';
                    newHealth.dbError = healthData.services?.database?.error || 'Database error';
                } else {
                    newHealth.database = 'disconnected';
                }
            } else {
                newHealth.api = 'error';
                newHealth.apiError = `HTTP ${healthCheck.status}: ${healthCheck.statusText}`;
            }
        } catch (err: any) {
            newHealth.api = 'offline';
            if (err.name === 'TimeoutError' || err.message?.includes('timeout')) {
                newHealth.apiError = 'Connection timeout - Server not responding';
            } else if (err.message?.includes('Failed to fetch') || err.message?.includes('NetworkError')) {
                newHealth.apiError = 'Cannot reach server - Check if port 3000 is open';
            } else {
                newHealth.apiError = err.message || 'Unknown error';
            }
            newHealth.database = 'disconnected';
            newHealth.dbError = 'API not reachable';
        }

        // 3. Network accessibility (if we have external IP)
        if (ip && ip !== '127.0.0.1' && newHealth.api === 'online') {
            try {
                const extCheck = await fetch(`${externalUrl}/api/health`, {
                    method: 'GET',
                    signal: AbortSignal.timeout(5000)
                });
                newHealth.network = extCheck.ok ? 'accessible' : 'blocked';
                if (!extCheck.ok) {
                    newHealth.networkError = 'External access blocked';
                }
            } catch (err: any) {
                newHealth.network = 'blocked';
                newHealth.networkError = 'Firewall may be blocking access';
            }
        } else {
            newHealth.network = 'unknown';
        }

        setHealth(newHealth);
        setLastHealthCheck(new Date());
        setIsCheckingHealth(false);
    };

    useEffect(() => {
        if (!window.electron) return;

        // Fetch auto-start status
        // @ts-ignore
        window.electron.ipcRenderer.invoke('server-mode:get-autostart-status').then((status: any) => {
            // Not using auto-start in this UI anymore
        });

        // Fetch Server Status
        // @ts-ignore
        window.electron.ipcRenderer.invoke('server-mode:get-status').then((status: any) => {
            if (status && status.running) {
                setServerStartTime(status.startTime);
                setPort(status.port || 3000);
                setUptime(Math.floor((Date.now() - status.startTime) / 1000));
            } else {
                setUptime(0);
                // If server didn't start, show the error from main process
                if (status?.error) {
                    setHealth(prev => ({
                        ...prev,
                        api: 'error',
                        apiError: status.error,
                        database: 'error',
                        dbError: 'Server not started'
                    }));
                }
                // If in client mode, show appropriate message
                if (status?.isClientMode) {
                    setHealth(prev => ({
                        ...prev,
                        api: 'error',
                        apiError: 'App is in Client Mode - Server is disabled',
                        database: 'error',
                        dbError: 'Client Mode active'
                    }));
                }
            }
        });

        // Fetch IP
        // @ts-ignore
        window.electron.ipcRenderer.invoke('server-mode:get-ip').then((ipAddress: string) => {
            setIp(ipAddress);
        });

        const interval = setInterval(() => {
            setUptime((currentUptime) => {
                if (serverStartTime > 0) {
                    return Math.floor((Date.now() - serverStartTime) / 1000);
                }
                return currentUptime + 1;
            });
        }, 1000);
        return () => clearInterval(interval);
    }, [serverStartTime]);

    // Initial health check
    useEffect(() => {
        if (ip && port) {
            checkServerHealth();
        }
    }, [ip, port]);

    const handleStopServer = async () => {
        try {
            // @ts-ignore
            await window.electron.ipcRenderer.invoke('server-mode:stop');
            navigate('/select-user');
        } catch (error) {
            console.error(error);
            navigate('/select-user');
        }
    };

    const formatUptime = (seconds: number) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        return `${h}h ${m}m ${s}s`;
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'online':
            case 'connected':
            case 'accessible':
                return <CheckCircle2 className="w-5 h-5 text-green-400" />;
            case 'checking':
                return <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />;
            case 'offline':
            case 'disconnected':
            case 'blocked':
                return <XCircle className="w-5 h-5 text-red-400" />;
            case 'error':
                return <AlertTriangle className="w-5 h-5 text-amber-400" />;
            default:
                return <Activity className="w-5 h-5 text-slate-400" />;
        }
    };

    const getStatusBadge = (status: string, type: string) => {
        const statusConfig: Record<string, { text: string; className: string }> = {
            // API statuses
            'api-online': { text: 'ONLINE', className: 'bg-green-500/20 text-green-400 border-green-500/30' },
            'api-offline': { text: 'OFFLINE', className: 'bg-red-500/20 text-red-400 border-red-500/30' },
            'api-error': { text: 'ERROR', className: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
            'api-checking': { text: 'CHECKING...', className: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },

            // Database statuses
            'database-connected': { text: 'CONNECTED', className: 'bg-green-500/20 text-green-400 border-green-500/30' },
            'database-disconnected': { text: 'DISCONNECTED', className: 'bg-red-500/20 text-red-400 border-red-500/30' },
            'database-error': { text: 'ERROR', className: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
            'database-checking': { text: 'CHECKING...', className: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },

            // Network statuses
            'network-accessible': { text: 'ACCESSIBLE', className: 'bg-green-500/20 text-green-400 border-green-500/30' },
            'network-blocked': { text: 'BLOCKED', className: 'bg-red-500/20 text-red-400 border-red-500/30' },
            'network-unknown': { text: 'LOCAL ONLY', className: 'bg-slate-500/20 text-slate-400 border-slate-500/30' },
            'network-checking': { text: 'CHECKING...', className: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
        };

        const key = `${type}-${status}`;
        const config = statusConfig[key] || { text: status.toUpperCase(), className: 'bg-slate-500/20 text-slate-400' };

        return (
            <Badge variant="outline" className={`font-bold text-xs ${config.className}`}>
                {config.text}
            </Badge>
        );
    };

    const isHealthy = health.api === 'online' && health.database === 'connected';
    const hasIssues = health.api === 'offline' || health.api === 'error' ||
        health.database === 'disconnected' || health.database === 'error' ||
        health.network === 'blocked';

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-slate-100 p-4">
            <Card className="w-full max-w-lg border-slate-700/50 bg-slate-800/80 backdrop-blur-sm text-slate-100 shadow-2xl">
                <CardHeader className="text-center pb-2">
                    <div className={`w-20 h-20 mx-auto rounded-full flex items-center justify-center mb-4 transition-all duration-500 ${isHealthy
                        ? 'bg-green-500/20 ring-2 ring-green-500/30'
                        : hasIssues
                            ? 'bg-red-500/20 ring-2 ring-red-500/30 animate-pulse'
                            : 'bg-blue-500/20 ring-2 ring-blue-500/30 animate-pulse'
                        }`}>
                        {isHealthy ? (
                            <Server className="w-10 h-10 text-green-400" />
                        ) : hasIssues ? (
                            <AlertTriangle className="w-10 h-10 text-red-400" />
                        ) : (
                            <Loader2 className="w-10 h-10 text-blue-400 animate-spin" />
                        )}
                    </div>
                    <CardTitle className="text-2xl font-bold tracking-tight text-white">
                        {isHealthy ? 'Server Mode Active' : hasIssues ? 'Server Issues Detected' : 'Checking Status...'}
                    </CardTitle>
                    <CardDescription className="text-slate-400">
                        {isHealthy
                            ? 'Dental Flow Backend Services are Running'
                            : hasIssues
                                ? 'Some services need attention'
                                : 'Verifying server health...'}
                    </CardDescription>
                </CardHeader>

                <CardContent className="space-y-4">
                    {/* Health Status Section */}
                    <div className="grid gap-2">
                        {/* API Status */}
                        <div className={`flex items-center justify-between p-3 rounded-lg border transition-all ${health.api === 'online'
                            ? 'bg-green-500/5 border-green-500/20'
                            : health.api === 'offline' || health.api === 'error'
                                ? 'bg-red-500/5 border-red-500/20'
                                : 'bg-slate-700/50 border-slate-600'
                            }`}>
                            <div className="flex items-center gap-3">
                                {getStatusIcon(health.api)}
                                <div>
                                    <span className="font-medium">API Server</span>
                                    {health.apiError && (
                                        <p className="text-xs text-red-400 mt-0.5">{health.apiError}</p>
                                    )}
                                </div>
                            </div>
                            {getStatusBadge(health.api, 'api')}
                        </div>

                        {/* Database Status */}
                        <div className={`flex items-center justify-between p-3 rounded-lg border transition-all ${health.database === 'connected'
                            ? 'bg-green-500/5 border-green-500/20'
                            : health.database === 'disconnected' || health.database === 'error'
                                ? 'bg-red-500/5 border-red-500/20'
                                : 'bg-slate-700/50 border-slate-600'
                            }`}>
                            <div className="flex items-center gap-3">
                                <Database className={`w-5 h-5 ${health.database === 'connected' ? 'text-green-400' :
                                    health.database === 'checking' ? 'text-blue-400' : 'text-red-400'
                                    }`} />
                                <div>
                                    <span className="font-medium">Database</span>
                                    {health.dbError && (
                                        <p className="text-xs text-red-400 mt-0.5">{health.dbError}</p>
                                    )}
                                </div>
                            </div>
                            {getStatusBadge(health.database, 'database')}
                        </div>

                        {/* Network Status */}
                        <div className={`flex items-center justify-between p-3 rounded-lg border transition-all ${health.network === 'accessible'
                            ? 'bg-green-500/5 border-green-500/20'
                            : health.network === 'blocked'
                                ? 'bg-red-500/5 border-red-500/20'
                                : 'bg-slate-700/50 border-slate-600'
                            }`}>
                            <div className="flex items-center gap-3">
                                <Globe className={`w-5 h-5 ${health.network === 'accessible' ? 'text-green-400' :
                                    health.network === 'blocked' ? 'text-red-400' :
                                        health.network === 'checking' ? 'text-blue-400' : 'text-slate-400'
                                    }`} />
                                <div>
                                    <span className="font-medium">Network Access</span>
                                    {health.networkError && (
                                        <p className="text-xs text-amber-400 mt-0.5">{health.networkError}</p>
                                    )}
                                </div>
                            </div>
                            {getStatusBadge(health.network, 'network')}
                        </div>
                    </div>

                    {/* Connection Info */}
                    <div className="grid gap-2 pt-2 border-t border-slate-700/50">
                        <div className="flex items-center justify-between p-3 rounded-lg bg-slate-700/30 border border-slate-600/50">
                            <div className="flex items-center gap-3">
                                <Wifi className="w-5 h-5 text-purple-400" />
                                <span className="font-medium">Server IP</span>
                            </div>
                            <div
                                className="flex items-center gap-2 cursor-pointer hover:bg-slate-700 px-2 py-1 rounded transition-colors"
                                onClick={() => copyToClipboard(ip, 'ip')}
                                title="Click to Copy IP"
                            >
                                <span className="font-mono text-slate-300">
                                    {ip || 'Detecting...'}
                                </span>
                                {copiedField === 'ip' ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4 text-slate-400" />}
                            </div>
                        </div>

                        <div className="flex items-center justify-between p-3 rounded-lg bg-slate-700/30 border border-slate-600/50">
                            <div className="flex items-center gap-3">
                                <Server className="w-5 h-5 text-orange-400" />
                                <span className="font-medium">Server Port</span>
                            </div>
                            <div
                                className="flex items-center gap-2 cursor-pointer hover:bg-slate-700 px-2 py-1 rounded transition-colors"
                                onClick={() => copyToClipboard(String(port), 'port')}
                                title="Click to Copy Port"
                            >
                                <span className="font-mono text-slate-300">
                                    {port}
                                </span>
                                {copiedField === 'port' ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4 text-slate-400" />}
                            </div>
                        </div>

                        <div className="flex items-center justify-between p-3 rounded-lg bg-slate-700/30 border border-slate-600/50">
                            <div className="flex items-center gap-3">
                                <Power className="w-5 h-5 text-amber-400" />
                                <span className="font-medium">Uptime</span>
                            </div>
                            <span className="font-mono text-slate-300">
                                {formatUptime(uptime)}
                            </span>
                        </div>
                    </div>

                    {/* Troubleshooting Tips */}
                    {hasIssues && (
                        <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20 space-y-2">
                            <h4 className="font-semibold text-amber-400 flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4" />
                                Troubleshooting Tips
                            </h4>
                            <ul className="text-sm text-slate-300 space-y-1 list-disc list-inside">
                                {health.api === 'offline' && (
                                    <>
                                        <li>Make sure the application is running in Server Mode</li>
                                        <li>Check if port {port} is not blocked by firewall</li>
                                        <li>Try restarting the application</li>
                                    </>
                                )}
                                {health.network === 'blocked' && (
                                    <>
                                        <li>Allow Dental Flow through Windows Firewall</li>
                                        <li>Ensure both devices are on the same network</li>
                                        <li>Try disabling VPN if enabled</li>
                                    </>
                                )}
                                {health.database === 'disconnected' && (
                                    <>
                                        <li>Database file may be corrupted or missing</li>
                                        <li>Try restarting the application</li>
                                    </>
                                )}
                            </ul>
                        </div>
                    )}

                    {/* Last Check Info */}
                    {lastHealthCheck && (
                        <div className="flex items-center justify-between text-xs text-slate-500">
                            <span>Last checked: {lastHealthCheck.toLocaleTimeString()}</span>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={checkServerHealth}
                                disabled={isCheckingHealth}
                                className="h-7 px-2 text-xs text-slate-400 hover:text-white"
                            >
                                <RefreshCw className={`w-3 h-3 mr-1 ${isCheckingHealth ? 'animate-spin' : ''}`} />
                                Refresh
                            </Button>
                        </div>
                    )}

                    {/* Info Box */}
                    <div className="p-4 rounded-lg bg-slate-900/50 border border-slate-700 text-sm text-slate-400 text-center leading-relaxed">
                        {isHealthy ? (
                            <>
                                <p className="font-medium text-green-400 mb-1">✓ Server is ready for connections</p>
                                <p>Other devices can connect using: <span className="font-mono text-white">{ip}:{port}</span></p>
                            </>
                        ) : (
                            <>
                                <p>The application is running in headless server mode.</p>
                                <p>Database and API endpoints should be active on port {port}.</p>
                            </>
                        )}
                    </div>

                    {/* Actions */}
                    <div className="pt-2 space-y-3">
                        <Button
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold"
                            onClick={() => navigate('/select-user')}
                        >
                            Login to Dental Flow
                            <span className="ml-2 text-xs font-normal opacity-80">(Keep Server Running)</span>
                        </Button>

                        <Button
                            variant="outline"
                            className="w-full border-slate-600 bg-transparent text-white hover:bg-slate-700 hover:text-white"
                            onClick={handleStopServer}
                        >
                            Close Server Mode
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default ServerMode;
