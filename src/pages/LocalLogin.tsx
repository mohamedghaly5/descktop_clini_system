import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { User, Lock, ArrowLeft, Users, Loader2, AlertCircle } from 'lucide-react';
import { useToast } from "@/components/ui/use-toast";

interface LocalUser {
    id: string;
    name: string;
    role: string;
}

const LocalLogin = () => {
    const { login } = useAuth();
    const navigate = useNavigate();
    const { toast } = useToast();

    const [users, setUsers] = useState<LocalUser[]>([]);
    const [selectedUser, setSelectedUser] = useState<LocalUser | null>(null);
    const [pin, setPin] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isLoggingIn, setIsLoggingIn] = useState(false);
    const { hasAdmin } = useAuth(); // Added

    useEffect(() => {
        loadUsers();
    }, []);

    // Check if we need to redirect to admin creation
    useEffect(() => {
        if (hasAdmin === false) {
            navigate('/create-admin');
        }
    }, [hasAdmin, navigate]);

    const loadUsers = async () => {
        try {
            // @ts-ignore
            const fetchedUsers = await window.api.getActiveUsers();
            setUsers(fetchedUsers);
        } catch (error) {
            console.error('Failed to load users', error);
            toast({
                variant: "destructive",
                title: "Error loading users",
                description: "Could not fetch local user list."
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedUser || !pin) return;

        setIsLoggingIn(true);
        const result = await login(selectedUser.id, pin);
        setIsLoggingIn(false);

        if (result.success) {
            navigate('/');
        } else {
            toast({
                variant: "destructive",
                title: "Login Failed",
                description: result.error || "Invalid PIN"
            });
            setPin('');
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">

            <div className="mb-8 text-center">
                <h1 className="text-3xl font-bold tracking-tight mb-2">Dental Flow</h1>
                <p className="text-muted-foreground">Secure Local Validation</p>
            </div>

            {!selectedUser ? (
                // User Selection Screen
                <Card className="w-full max-w-md">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Users className="h-5 w-5" /> Select User
                        </CardTitle>
                        <CardDescription>Choose your profile to continue.</CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-3">
                        {users.length === 0 ? (
                            <div className="text-center p-4 text-muted-foreground">
                                No active users found.
                            </div>
                        ) : (
                            users.map(user => (
                                <button
                                    key={user.id}
                                    onClick={() => setSelectedUser(user)}
                                    className="flex items-center justify-between w-full p-4 rounded-lg border bg-card hover:bg-accent hover:text-accent-foreground transition-colors text-left"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                                            {user.name.charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <p className="font-medium">{user.name}</p>
                                            <p className="text-xs text-muted-foreground capitalize">{user.role}</p>
                                        </div>
                                    </div>
                                    <ArrowLeft className="h-4 w-4 rotate-180 text-muted-foreground" />
                                </button>
                            ))
                        )}
                    </CardContent>
                </Card>
            ) : (
                // PIN Entry Screen
                <Card className="w-full max-w-sm">
                    <CardHeader>
                        <div className="text-center mb-4">
                            <div className="h-20 w-20 mx-auto rounded-full bg-primary/10 flex items-center justify-center text-primary text-3xl font-bold mb-3">
                                {selectedUser.name.charAt(0).toUpperCase()}
                            </div>
                            <CardTitle>{selectedUser.name}</CardTitle>
                            <CardDescription className="capitalize">{selectedUser.role}</CardDescription>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleLogin} className="space-y-4">
                            <div className="relative">
                                <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    type="password"
                                    placeholder="Enter PIN"
                                    className="pl-9 text-center tracking-widest text-lg" // Masked PIN
                                    value={pin}
                                    onChange={(e) => setPin(e.target.value)}
                                    autoFocus
                                    maxLength={8}
                                />
                            </div>

                            <Button type="submit" className="w-full" disabled={isLoggingIn || !pin}>
                                {isLoggingIn ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : null}
                                Login
                            </Button>

                            <Button
                                type="button"
                                variant="ghost"
                                className="w-full"
                                onClick={() => { setSelectedUser(null); setPin(''); }}
                            >
                                Switch User
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            )}
        </div>
    );
};

export default LocalLogin;
