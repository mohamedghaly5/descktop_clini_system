import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ShieldCheck, Loader2, Lock, UserPlus } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from "@/components/ui/use-toast";
import { useNavigate } from 'react-router-dom';

const CreateAdminWizard = () => {
    const { createInitialAdmin, hasAdmin } = useAuth();
    const { toast } = useToast();
    const navigate = useNavigate();

    const [name, setName] = useState('');
    const [pin, setPin] = useState('');
    const [confirmPin, setConfirmPin] = useState('');
    const [loading, setLoading] = useState(false);

    // Safety redirect if admin already exists
    React.useEffect(() => {
        if (hasAdmin === true) {
            navigate('/login');
        }
    }, [hasAdmin, navigate]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!name.trim()) {
            toast({ variant: "destructive", title: "Name Required", description: "Please enter the Administrator's name." });
            return;
        }

        if (pin.length < 4) {
            toast({ variant: "destructive", title: "Invalid PIN", description: "PIN must be at least 4 digits." });
            return;
        }

        if (!/^\d+$/.test(pin)) {
            toast({ variant: "destructive", title: "Invalid PIN", description: "PIN must be numbers only." });
            return;
        }

        if (pin !== confirmPin) {
            toast({ variant: "destructive", title: "Mismatch", description: "PINs do not match." });
            return;
        }

        setLoading(true);
        const res = await createInitialAdmin({ name, pin });
        setLoading(false);

        if (!res.success) {
            toast({ variant: "destructive", title: "Error", description: res.error || "Failed to create admin." });
        } else {
            toast({ title: "Success", description: "Administrator created successfully. Please log in." });
            navigate('/login');
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-blue-50 p-4" dir="rtl">
            <Card className="w-full max-w-md border-blue-200 shadow-xl">
                <CardHeader className="text-center">
                    <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                        <UserPlus className="h-8 w-8 text-blue-600" />
                    </div>
                    <CardTitle className="text-blue-700 text-2xl font-bold">إنشاء حساب المدير</CardTitle>
                    <CardDescription className="text-gray-600">
                        مرحباً بك في Dental Flow. يرجى إنشاء حساب المدير الأول للبدء.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">اسم المدير</label>
                            <Input
                                type="text"
                                value={name}
                                onChange={e => setName(e.target.value)}
                                placeholder="مثال: د. محمد"
                                className="text-right"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">رمز الدخول (PIN)</label>
                            <div className="relative">
                                <Lock className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    type="password"
                                    className="pr-9 text-left" // LTR for numbers but aligned properly
                                    value={pin}
                                    onChange={e => setPin(e.target.value)}
                                    maxLength={8}
                                    style={{ direction: 'ltr' }}
                                    placeholder="****"
                                />
                            </div>
                            <p className="text-xs text-muted-foreground">يجب أن يتكون من 4 أرقام على الأقل.</p>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">تأكيد رمز الدخول</label>
                            <div className="relative">
                                <Lock className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    type="password"
                                    className="pr-9 text-left"
                                    value={confirmPin}
                                    onChange={e => setConfirmPin(e.target.value)}
                                    maxLength={8}
                                    style={{ direction: 'ltr' }}
                                    placeholder="****"
                                />
                            </div>
                        </div>

                        <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white mt-4" disabled={loading}>
                            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="ml-2 h-4 w-4" />}
                            إنشاء الحساب
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
};

export default CreateAdminWizard;
