import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { User as UserIcon, Lock, Loader2, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';

interface AuthUser {
    id: string;
    name: string;
    role: 'admin' | 'doctor' | 'staff';
    clinic_id: string;
}

const SelectUser = () => {
    const navigate = useNavigate();
    const { login } = useAuth();

    const [users, setUsers] = useState<AuthUser[]>([]);
    const [loading, setLoading] = useState(true);

    const [selectedUser, setSelectedUser] = useState<AuthUser | null>(null);
    const [pin, setPin] = useState('');
    const [rememberMe, setRememberMe] = useState(false);
    const [isLoggingIn, setIsLoggingIn] = useState(false);

    useEffect(() => {
        const loadUsers = async () => {
            try {
                // @ts-ignore
                const fetchedUsers = await window.electron.ipcRenderer.invoke('auth:get-users');
                setUsers(fetchedUsers);
            } catch (error) {
                console.error('Failed to load users', error);
                toast.error('Failed to load users');
            } finally {
                setLoading(false);
            }
        };
        loadUsers();
    }, []);

    const handleUserSelect = (user: AuthUser) => {
        setSelectedUser(user);
        setPin(''); // Reset PIN on user switch
        // Focus PIN input automatically? (requires ref, skipping for simplicity)
    };

    const handleLogin = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!selectedUser || !pin) return;

        setIsLoggingIn(true);
        try {
            // Pass rememberMe to login function
            const result = await login(selectedUser.id, pin, rememberMe);

            if (result.success) {
                toast.success(`Welcome back, ${selectedUser.name}`);
                navigate('/');
            } else {
                toast.error(result.error || 'Login failed');
            }
        } catch (error) {
            toast.error('An unexpected error occurred');
        } finally {
            setIsLoggingIn(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
            <div className="w-full max-w-md space-y-8">
                <div className="text-center">
                    <h1 className="text-3xl font-bold text-gray-900">Dental Flow</h1>
                    <p className="mt-2 text-gray-600">Select your profile to continue</p>
                </div>

                {!selectedUser ? (
                    // USER SELECTION LIST
                    <div className="grid gap-4 mt-8">
                        {users.length === 0 ? (
                            <div className="text-center p-4 bg-yellow-50 rounded-lg text-yellow-700">
                                No users found. Please create an admin first.
                                <Button variant="link" onClick={() => navigate('/create-admin')}>Create Admin</Button>
                            </div>
                        ) : (
                            users.map(user => (
                                <Card
                                    key={user.id}
                                    className="cursor-pointer hover:border-primary transition-all hover:shadow-md"
                                    onClick={() => handleUserSelect(user)}
                                >
                                    <CardContent className="flex items-center p-4 space-x-4">
                                        <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold 
                    ${user.role === 'admin' ? 'bg-red-100 text-red-600' :
                                                user.role === 'doctor' ? 'bg-blue-100 text-blue-600' : 'bg-green-100 text-green-600'}`}>
                                            {user.name.charAt(0).toUpperCase()}
                                        </div>
                                        <div className="flex-1">
                                            <h3 className="font-semibold text-gray-900">{user.name}</h3>
                                            <p className="text-sm text-gray-500 capitalize">{user.role}</p>
                                        </div>
                                        <ArrowRight className="w-5 h-5 text-gray-400" />
                                    </CardContent>
                                </Card>
                            ))
                        )}
                    </div>
                ) : (
                    // PIN ENTRY
                    <Card className="mt-8 border-none shadow-lg">
                        <CardContent className="p-8 space-y-6">
                            <div className="text-center">
                                <div className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center text-2xl font-bold mb-4
                  ${selectedUser.role === 'admin' ? 'bg-red-100 text-red-600' :
                                        selectedUser.role === 'doctor' ? 'bg-blue-100 text-blue-600' : 'bg-green-100 text-green-600'}`}>
                                    {selectedUser.name.charAt(0).toUpperCase()}
                                </div>
                                <h3 className="text-xl font-bold">{selectedUser.name}</h3>
                                <p className="text-gray-500 capitalize">{selectedUser.role}</p>
                            </div>

                            <form onSubmit={handleLogin} className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="pin">Enter PIN</Label>
                                    <div className="relative">
                                        <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                                        <Input
                                            id="pin"
                                            type="password"
                                            placeholder="Enter your PIN"
                                            className="pl-10 text-center text-lg tracking-widest"
                                            value={pin}
                                            onChange={(e) => setPin(e.target.value)}
                                            autoFocus
                                            maxLength={8}
                                        />
                                    </div>
                                </div>

                                <div className="flex items-center space-x-2">
                                    <Checkbox
                                        id="remember"
                                        checked={rememberMe}
                                        onCheckedChange={(c) => setRememberMe(c as boolean)}
                                    />
                                    <Label htmlFor="remember" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                        Remember me
                                    </Label>
                                </div>

                                <div className="flex gap-3">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        className="flex-1"
                                        onClick={() => { setSelectedUser(null); setPin(''); }}
                                    >
                                        Back
                                    </Button>
                                    <Button
                                        type="submit"
                                        className="flex-1"
                                        disabled={!pin || isLoggingIn}
                                    >
                                        {isLoggingIn ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                                        Login
                                    </Button>
                                </div>
                            </form>
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    );
};

export default SelectUser;
