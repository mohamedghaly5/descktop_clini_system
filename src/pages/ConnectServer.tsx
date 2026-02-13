import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Network, Server, Loader2, ArrowLeft, Wifi } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

const ConnectServer = () => {
    const navigate = useNavigate();
    const [ip, setIp] = useState('');
    const [isConnecting, setIsConnecting] = useState(false);

    const handleConnect = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!ip) return;

        setIsConnecting(true);
        try {
            // @ts-ignore
            if ((window as any).electron) {
                // Desktop Client Mode
                // @ts-ignore
                const result = await window.electron.ipcRenderer.invoke('client:connect', ip);
                if (result.success) {
                    toast.success('Connected to Server! Restarting...');
                    setTimeout(() => window.location.reload(), 1500);
                } else {
                    toast.error(result.error || 'Failed to connect');
                }
            } else {
                // Web / Mobile Mode
                let url = ip.trim();
                if (!url.startsWith('http')) url = 'http://' + url;
                if (url.endsWith('/')) url = url.slice(0, -1);

                // Smart port check
                // If no port found, assume 3000 for standard setup
                // Logic: remove protocol, check end for :digits
                const cleanUrl = url.replace('http://', '').replace('https://', '');
                const hasPort = /:\d+$/.test(cleanUrl);

                if (!hasPort) {
                    url = url + ':3000';
                }

                localStorage.setItem('server_url', url);
                toast.success(`Configured: ${url}`);
                setTimeout(() => {
                    window.location.href = '/';
                }, 1000);
            }

        } catch (error: any) {
            console.error(error);
            toast.error('Connection failed: ' + error.message);
        } finally {
            setIsConnecting(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
            <Card className="w-full max-w-md shadow-xl">
                <CardHeader className="text-center space-y-2">
                    <div className="w-16 h-16 mx-auto bg-primary/10 rounded-full flex items-center justify-center mb-2">
                        <Network className="w-8 h-8 text-primary" />
                    </div>
                    <CardTitle className="text-2xl">Connect to Server</CardTitle>
                    <CardDescription>
                        Enter the IP address of the Admin Server computer on your local network.
                    </CardDescription>
                </CardHeader>
                <form onSubmit={handleConnect}>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="ip">Server IP Address</Label>
                            <div className="relative">
                                <Wifi className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                                <Input
                                    id="ip"
                                    placeholder="192.168.1.xxx"
                                    className="pl-10 font-mono"
                                    value={ip}
                                    onChange={(e) => setIp(e.target.value)}
                                    autoFocus
                                />
                            </div>
                            <p className="text-xs text-muted-foreground">
                                You can find this on the Admin device's "Server Mode" screen.
                            </p>
                        </div>
                    </CardContent>
                    <CardFooter className="flex flex-col gap-3">
                        <Button
                            type="submit"
                            className="w-full gap-2"
                            disabled={!ip || isConnecting}
                        >
                            {isConnecting ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <Server className="w-4 h-4" />
                            )}
                            {isConnecting ? 'Connecting...' : 'Connect'}
                        </Button>
                        <Button
                            type="button"
                            variant="ghost"
                            className="w-full text-muted-foreground"
                            onClick={() => navigate('/select-user')}
                        >
                            <ArrowLeft className="w-4 h-4 mr-2" />
                            Back to Local Mode
                        </Button>
                    </CardFooter>
                </form>
            </Card>
        </div>
    );
};

export default ConnectServer;
