import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ShieldAlert, Loader2, Lock } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from "@/components/ui/use-toast";

const ForceChangePin = () => {
    const { changePin, user } = useAuth();
    const { toast } = useToast();

    const [currentPin, setCurrentPin] = useState('');
    const [newPin, setNewPin] = useState('');
    const [confirmPin, setConfirmPin] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (newPin !== confirmPin) {
            toast({ variant: "destructive", title: "Mismatch", description: "New Passwords do not match" });
            return;
        }

        if (newPin.length < 4) {
            toast({ variant: "destructive", title: "Invalid PIN", description: "PIN must be at least 4 digits" });
            return;
        }

        if (newPin === '0000') {
            toast({ variant: "destructive", title: "Weak PIN", description: "You cannot use '0000'" });
            return;
        }

        setLoading(true);
        const res = await changePin(currentPin, newPin);
        setLoading(false);

        if (!res.success) {
            toast({ variant: "destructive", title: "Error", description: res.error || "Failed to update PIN" });
        } else {
            toast({ title: "Success", description: "PIN Updated Successfully" });
            // AuthContext logic will clear 'mustChangePin' and allow navigation automatically
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-red-50 p-4">
            <Card className="w-full max-w-md border-red-200 shadow-xl">
                <CardHeader className="text-center">
                    <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
                        <ShieldAlert className="h-8 w-8 text-red-600 animate-pulse" />
                    </div>
                    <CardTitle className="text-red-700">Security Update Required</CardTitle>
                    <CardDescription>
                        Hello {user?.name}. For your security, you must change your default PIN before continuing.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Current PIN (Default: 0000)</label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    type="password"
                                    className="pl-9"
                                    value={currentPin}
                                    onChange={e => setCurrentPin(e.target.value)}
                                    maxLength={8}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">New PIN</label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    type="password"
                                    className="pl-9"
                                    value={newPin}
                                    onChange={e => setNewPin(e.target.value)}
                                    maxLength={8}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Confirm New PIN</label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    type="password"
                                    className="pl-9"
                                    value={confirmPin}
                                    onChange={e => setConfirmPin(e.target.value)}
                                    maxLength={8}
                                />
                            </div>
                        </div>

                        <Button type="submit" className="w-full bg-red-600 hover:bg-red-700 text-white" disabled={loading}>
                            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Update Secure PIN
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
};

export default ForceChangePin;
