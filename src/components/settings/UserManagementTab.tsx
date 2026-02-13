import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, UserPlus, Users, Loader2, Shield, Lock, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';

// Zod Schema
const createUserSchema = z.object({
    name: z.string().min(2, "Name must be at least 2 characters"),
    role: z.enum(["doctor", "staff"], {
        errorMap: () => ({ message: "Please select a valid role" }),
    }),
    pin: z.string().min(4, "PIN must be at least 4 digits"),
    permissions: z.array(z.string()).default([]),
});

type CreateUserFormValues = z.infer<typeof createUserSchema>;

interface User {
    id: string;
    name: string;
    role: string;
    clinic_id: string;
}

interface Permission {
    id: string;
    code: string;
    name: string;
}

const UserManagementTab = () => {
    const { user: currentUser, hasPermission } = useAuth();
    const { t, language } = useLanguage();
    const [users, setUsers] = useState<User[]>([]);
    const [permissions, setPermissions] = useState<Permission[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isDialogOpen, setIsDialogOpen] = useState(false);

    // Edit Permissions State
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [editPermissions, setEditPermissions] = useState<string[]>([]);
    const [isSavingPerms, setIsSavingPerms] = useState(false);

    // Form
    const form = useForm<CreateUserFormValues>({
        resolver: zodResolver(createUserSchema),
        defaultValues: {
            name: '',
            role: 'doctor',
            pin: '',
            permissions: [],
        },
    });

    const fetchUsers = async () => {
        try {
            // @ts-ignore
            const result = await window.electron.ipcRenderer.invoke('auth:get-users');
            if (Array.isArray(result)) {
                setUsers(result);
            }
        } catch (error) {
            console.error("Failed to fetch users:", error);
        }
    };

    const fetchPermissions = async () => {
        try {
            // @ts-ignore
            const result = await window.electron.ipcRenderer.invoke('auth:get-permissions');
            if (Array.isArray(result)) {
                setPermissions(result);
            }
        } catch (error) {
            console.error("Failed to fetch permissions:", error);
        }
    };

    useEffect(() => {
        fetchUsers();
        fetchPermissions();
    }, []);

    // Set default permissions when opening Add User dialog
    useEffect(() => {
        if (isDialogOpen && permissions.length > 0) {
            const systemCodes = ['ADD_USER', 'CLINIC_SETTINGS', 'MANAGE_LICENSE'];
            const defaultPerms = permissions
                .filter(p => !systemCodes.includes(p.code))
                .map(p => p.code);
            form.setValue('permissions', defaultPerms);
        }
    }, [isDialogOpen, permissions, form]);

    const onSubmit = async (data: CreateUserFormValues) => {
        setIsLoading(true);
        try {
            // @ts-ignore
            const result = await window.electron.ipcRenderer.invoke('user:create', data);

            if (result.success) {
                toast.success(language === 'ar' ? 'تم إنشاء المستخدم بنجاح' : 'User created successfully');
                setIsDialogOpen(false);
                form.reset();
                fetchUsers();
            } else {
                toast.error(result.error || (language === 'ar' ? 'فشل إنشاء المستخدم' : 'Failed to create user'));
            }
        } catch (error) {
            console.error(error);
            toast.error(language === 'ar' ? 'حدث خطأ غير متوقع' : 'An unexpected error occurred');
        } finally {
            setIsLoading(false);
        }
    };

    const handleEditPermissions = async (targetUser: User) => {
        setEditingUser(targetUser);
        setEditPermissions([]); // Reset momentarily
        try {
            // @ts-ignore
            const userPerms = await window.electron.ipcRenderer.invoke('users:get-permissions', targetUser.id);
            if (Array.isArray(userPerms)) {
                setEditPermissions(userPerms);
            }
        } catch (error) {
            console.error("Failed to fetch user permissions", error);
            toast.error(language === 'ar' ? 'فشل تحميل الصلاحيات' : 'Failed to load permissions');
        }
    };

    // State for changing PIN
    const [isChangePinOpen, setIsChangePinOpen] = useState(false);
    const [userToChangePin, setUserToChangePin] = useState<User | null>(null);
    const [oldPin, setOldPin] = useState('');
    const [newPin, setNewPin] = useState('');
    const [isChangingPin, setIsChangingPin] = useState(false);

    // State for deleting user
    const [userToDelete, setUserToDelete] = useState<User | null>(null);
    const [isDeletingUser, setIsDeletingUser] = useState(false);

    // ... existing forms

    const handleOpenChangePin = (targetUser: User) => {
        setUserToChangePin(targetUser);
        setOldPin('');
        setNewPin('');
        setIsChangePinOpen(true);
    };

    const handleSubmitChangePin = async () => {
        if (!userToChangePin || !newPin) return;

        // If user is editing themselves, oldPin might be required.
        // If Admin editing another, oldPin might be required as per instruction.
        if (!oldPin) {
            toast.error(language === 'ar' ? 'الرجاء إدخال كلمة المرور القديمة' : 'Please enter old password');
            return;
        }

        setIsChangingPin(true);
        try {
            // @ts-ignore
            const result = await window.electron.ipcRenderer.invoke('auth:update-user-pin', {
                userId: userToChangePin.id,
                oldPin: oldPin,
                newPin: newPin
            });

            if (result.success) {
                toast.success(language === 'ar' ? 'تم تغيير كلمة المرور بنجاح' : 'Password changed successfully');
                setIsChangePinOpen(false);
                setUserToChangePin(null);
            } else {
                toast.error(result.error || (language === 'ar' ? 'كلمة المرور القديمة غير صحيحة' : 'Incorrect old password'));
            }
        } catch (error) {
            console.error(error);
            toast.error(language === 'ar' ? 'فشل التغيير' : 'Change failed');
        } finally {
            setIsChangingPin(false);
        }
    };

    const requestDeleteUser = (targetUser: User) => {
        if (targetUser.role === 'admin') {
            toast.error(language === 'ar' ? 'لا يمكن حذف المدير' : 'Cannot delete Admin');
            return;
        }
        setUserToDelete(targetUser);
    };

    const confirmDeleteUser = async () => {
        if (!userToDelete) return;
        setIsDeletingUser(true);
        try {
            // @ts-ignore
            const result = await window.electron.ipcRenderer.invoke('auth:delete-user', userToDelete.id);

            if (result.success) {
                toast.success(language === 'ar' ? 'تم حذف المستخدم' : 'User deleted');
                setUsers(users.filter(u => u.id !== userToDelete.id));
                setUserToDelete(null);
            } else {
                toast.error(result.error || (language === 'ar' ? 'فشل الحذف' : 'Delete failed'));
            }
        } catch (error) {
            console.error(error);
            toast.error(language === 'ar' ? 'حدث خطأ' : 'Error occurred');
        } finally {
            setIsDeletingUser(false);
        }
    };

    const handleSavePermissions = async () => {
        if (!editingUser) return;
        setIsSavingPerms(true);
        try {
            // @ts-ignore
            const result = await window.electron.ipcRenderer.invoke('users:update-permissions', {
                userId: editingUser.id,
                permissions: editPermissions
            });

            if (result.success) {
                toast.success(language === 'ar' ? 'تم تحديث الصلاحيات' : 'Permissions updated');
                setEditingUser(null);
            } else {
                toast.error(result.error || (language === 'ar' ? 'فشل التحديث' : 'Update failed'));
            }
        } catch (error) {
            console.error(error);
            toast.error(language === 'ar' ? 'حدث خطأ' : 'Error occurred');
        } finally {
            setIsSavingPerms(false);
        }
    };

    // Helper to group permissions (moved outside render for cleanness or reused)
    const renderPermissionsList = (selectedPerms: string[], onChange: (code: string, checked: boolean) => void) => {
        const groups = {
            'إدارة المرضى': ['ADD_PATIENT', 'EDIT_PATIENT', 'DELETE_PATIENT'],
            'إدارة المواعيد': ['ADD_APPOINTMENT', 'EDIT_APPOINTMENT', 'DELETE_APPOINTMENT'],
            'الإجراءات الطبية': ['ADD_TREATMENT', 'DELETE_TREATMENT', 'UPLOAD_XRAY', 'DELETE_ATTACHMENT'],
            'الحسابات': ['CREATE_INVOICE', 'VIEW_FINANCIAL_REPORTS', 'VIEW_PAYMENTS'],
            'المصروفات': ['VIEW_EXPENSES', 'ADD_EXPENSE', 'EDIT_EXPENSE', 'DELETE_EXPENSE'],
            'المخزون': ['VIEW_STOCK', 'ADD_ITEM', 'SUBTRACT_ITEM', 'VIEW_STOCK_REPORTS'],
            'إدارة المعمل': ['ADD_LAB_ORDER', 'DELETE_LAB_ORDER', 'LAB_PAYMENT', 'LAB_STATUS_UPDATE'],
            'إدارة النظام': ['VIEW_SETTINGS', 'ADD_USER', 'CLINIC_SETTINGS', 'MANAGE_LICENSE']
        };

        return Object.keys(groups).map((groupName) => {
            // @ts-ignore
            const groupCodes = groups[groupName] as string[];
            // Sort permissions based on the order defined in groupCodes
            const groupPermissions = groupCodes
                .map(code => permissions.find(p => p.code === code))
                .filter(Boolean) as any[];
            if (groupPermissions.length === 0) return null;

            return (
                <div key={groupName} className="mb-4 text-start">
                    <h4 className="text-sm font-bold text-primary mb-2 pb-1 border-b">
                        {language === 'ar' ? groupName : groupName}
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {groupPermissions.map((perm) => (
                            <div key={perm.id} className="flex items-center space-x-2 rtl:space-x-reverse bg-muted/20 p-2 rounded hover:bg-muted/40 transition-colors">
                                <Checkbox
                                    id={`perm-${perm.id}`}
                                    checked={selectedPerms.includes(perm.code)}
                                    onCheckedChange={(checked) => onChange(perm.code, checked as boolean)}
                                />
                                <Label htmlFor={`perm-${perm.id}`} className="text-xs font-medium cursor-pointer flex-1">
                                    {perm.name}
                                </Label>
                            </div>
                        ))}
                    </div>
                </div>
            );
        });
    };


    // Only Admin or users with ADD_USER permission can see this content
    if (currentUser?.role !== 'admin' && !hasPermission('ADD_USER')) {
        return (
            <div className="flex items-center justify-center p-10 text-muted-foreground">
                <p>{language === 'ar' ? 'غير مصرح لك بالوصول لهذه الصفحة' : 'Access Denied'}</p>
            </div>
        );
    }

    return (
        <Card variant="elevated" className="animate-fade-in">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                            <Users className="w-6 h-6 text-primary" />
                        </div>
                        <div className="text-start">
                            <CardTitle>
                                {language === 'ar' ? 'إدارة المستخدمين' : 'User Management'}
                            </CardTitle>
                            <CardDescription>
                                {language === 'ar'
                                    ? 'إضافة وحذف مستخدمي تسجيل الدخول (أطباء، موظفي استقبال)'
                                    : 'Manage login users (Doctors, Receptionists)'}
                            </CardDescription>
                        </div>
                    </div>

                    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                        <DialogTrigger asChild>
                            <Button className="gap-2">
                                <UserPlus className="w-4 h-4" />
                                {language === 'ar' ? 'إضافة مستخدم' : 'Add User'}
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>
                                    {language === 'ar' ? 'إضافة مستخدم جديد' : 'Add New User'}
                                </DialogTitle>
                                <DialogDescription>
                                    {language === 'ar'
                                        ? 'قم بإنشاء حساب تسجيل دخول جديد. يجب تحديد الاسم، الدور، والرقم السري.'
                                        : 'Create a new login account. Specify name, role, and PIN.'}
                                </DialogDescription>
                            </DialogHeader>

                            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
                                <div className="space-y-2 text-start">
                                    <Label>{language === 'ar' ? 'الاسم' : 'Name'}</Label>
                                    <Input
                                        {...form.register('name')}
                                        placeholder={language === 'ar' ? 'مثال: د. أحمد' : 'e.g. Dr. Ahmed'}
                                    />
                                    {form.formState.errors.name && (
                                        <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
                                    )}
                                </div>

                                <div className="space-y-2 text-start">
                                    <Label>{language === 'ar' ? 'الدور' : 'Role'}</Label>
                                    <div dir={language === 'ar' ? 'rtl' : 'ltr'}>
                                        <Select
                                            onValueChange={(val) => form.setValue('role', val as 'doctor' | 'staff')}
                                            defaultValue={form.getValues('role')}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select role" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="doctor">
                                                    {language === 'ar' ? 'طبيب' : 'Doctor'}
                                                </SelectItem>
                                                <SelectItem value="staff">
                                                    {language === 'ar' ? 'موظف استقبال / مساعد' : 'Reception / Staff'}
                                                </SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    {form.formState.errors.role && (
                                        <p className="text-xs text-destructive">{form.formState.errors.role.message}</p>
                                    )}
                                </div>


                                <div className="space-y-2 text-start">
                                    <Label>{language === 'ar' ? 'الرقم السري (PIN)' : 'PIN Code'}</Label>
                                    <Input
                                        {...form.register('pin')}
                                        type="password"
                                        placeholder="****"
                                        maxLength={8}
                                    />
                                    {form.formState.errors.pin && (
                                        <p className="text-xs text-destructive">{form.formState.errors.pin.message}</p>
                                    )}
                                </div>

                                <div className="space-y-4 text-start max-h-[300px] overflow-y-auto border p-4 rounded-md">
                                    <Label className="text-lg font-semibold border-b pb-2 block mb-4">
                                        {language === 'ar' ? 'صلاحيات المستخدم' : 'User Permissions'}
                                    </Label>

                                    {/* Helper to group permissions */}
                                    {(() => {
                                        const groups = {
                                            'إدارة المرضى': ['ADD_PATIENT', 'EDIT_PATIENT', 'DELETE_PATIENT'],
                                            'إدارة المواعيد': ['ADD_APPOINTMENT', 'EDIT_APPOINTMENT', 'DELETE_APPOINTMENT'],
                                            'الإجراءات الطبية': ['ADD_TREATMENT', 'DELETE_TREATMENT', 'UPLOAD_XRAY'],
                                            'الحسابات': ['CREATE_INVOICE', 'VIEW_FINANCIAL_REPORTS', 'VIEW_PAYMENTS'],
                                            'المصروفات': ['VIEW_EXPENSES', 'ADD_EXPENSE', 'EDIT_EXPENSE', 'DELETE_EXPENSE'],
                                            'المخزون': ['VIEW_STOCK', 'ADD_ITEM', 'SUBTRACT_ITEM', 'VIEW_STOCK_REPORTS'],
                                            'إدارة النظام': ['VIEW_SETTINGS', 'ADD_USER', 'CLINIC_SETTINGS', 'MANAGE_LICENSE']
                                        };

                                        const groupKeys = Object.keys(groups);

                                        return groupKeys.map((groupName) => {
                                            // @ts-ignore
                                            const groupCodes = groups[groupName] as string[];
                                            // Sort permissions based on the order defined in groupCodes
                                            const groupPermissions = groupCodes
                                                .map(code => permissions.find(p => p.code === code))
                                                .filter(Boolean) as any[];

                                            // If no permissions loaded yet for this group or mismatch, skip or show basics
                                            if (groupPermissions.length === 0) return null;

                                            return (
                                                <div key={groupName} className="mb-6">
                                                    <h4 className="text-sm font-bold text-primary mb-3 bg-primary/5 p-2 rounded w-fit">
                                                        {language === 'ar' ? groupName : groupName} {/* Add Translation mapping if needed later */}
                                                    </h4>
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                        {groupPermissions.map((perm) => (
                                                            <div key={perm.id} className="flex items-center space-x-2 bg-secondary/20 p-2 rounded hover:bg-secondary/40 transition-colors">
                                                                <Checkbox
                                                                    id={perm.id}
                                                                    checked={form.watch('permissions')?.includes(perm.code)}
                                                                    onCheckedChange={(checked) => {
                                                                        const current = form.getValues('permissions') || [];
                                                                        if (checked) {
                                                                            form.setValue('permissions', [...current, perm.code]);
                                                                        } else {
                                                                            form.setValue('permissions', current.filter(c => c !== perm.code));
                                                                        }
                                                                    }}
                                                                />
                                                                <label
                                                                    htmlFor={perm.id}
                                                                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 px-2 cursor-pointer w-full"
                                                                >
                                                                    {perm.name}
                                                                </label>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            );
                                        });
                                    })()}
                                </div>

                                <DialogFooter className="gap-2 sm:gap-0">
                                    <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                                        {language === 'ar' ? 'إلغاء' : 'Cancel'}
                                    </Button>
                                    <Button type="submit" disabled={isLoading}>
                                        {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                        {language === 'ar' ? 'حفظ' : 'Save'}
                                    </Button>
                                </DialogFooter>
                            </form>
                        </DialogContent>
                    </Dialog>
                </div>
            </CardHeader>
            <CardContent>
                <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="text-start">{language === 'ar' ? 'الاسم' : 'Name'}</TableHead>
                                <TableHead className="text-start">{language === 'ar' ? 'الدور' : 'Role'}</TableHead>
                                <TableHead className="text-start">{language === 'ar' ? 'الحالة' : 'Status'}</TableHead>
                                <TableHead className="text-start">{language === 'ar' ? 'إجراءات' : 'Actions'}</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {users.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={4} className="text-center h-24 text-muted-foreground">
                                        {language === 'ar' ? 'لا يوجد مستخدمين' : 'No users found'}
                                    </TableCell>
                                </TableRow>
                            ) : (
                                users.map((u) => (
                                    <TableRow key={u.id}>
                                        <TableCell className="font-medium">{u.name}</TableCell>
                                        <TableCell>
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${u.role === 'admin' ? 'bg-purple-100 text-purple-800' :
                                                u.role === 'doctor' ? 'bg-blue-100 text-blue-800' :
                                                    'bg-gray-100 text-gray-800'
                                                }`}>
                                                {u.role === 'admin' ? (language === 'ar' ? 'مدير' : 'Admin') :
                                                    u.role === 'doctor' ? (language === 'ar' ? 'طبيب' : 'Doctor') :
                                                        (language === 'ar' ? 'موظف' : 'Staff')}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-start">
                                            <span className="text-green-600 text-sm flex items-center gap-1">
                                                <span className="w-2 h-2 rounded-full bg-green-600"></span>
                                                {language === 'ar' ? 'نشط' : 'Active'}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-start">
                                            <div className="flex items-center gap-2">
                                                {/* Permissions Edit */}
                                                {hasPermission('ADD_USER') && u.role !== 'admin' && (
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => handleEditPermissions(u)}
                                                        title={language === 'ar' ? 'تعديل الصلاحيات' : 'Edit Permissions'}
                                                    >
                                                        <Shield className="w-4 h-4 text-blue-600" />
                                                    </Button>
                                                )}

                                                {/* Change PIN */}
                                                {u.role !== 'admin' && (
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => handleOpenChangePin(u)}
                                                        title={language === 'ar' ? 'تغيير كلمة المرور' : 'Change Password'}
                                                    >
                                                        <Lock className="w-4 h-4 text-orange-600" />
                                                    </Button>
                                                )}

                                                {/* Delete User */}
                                                {u.role !== 'admin' && (
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="text-destructive hover:text-destructive/90 hover:bg-destructive/10"
                                                        onClick={() => requestDeleteUser(u)}
                                                        title={language === 'ar' ? 'حذف المستخدم' : 'Delete User'}
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                )}
                                                {u.role === 'admin' && (
                                                    <div className="w-9 h-9 flex items-center justify-center opacity-50 cursor-not-allowed" title="Admin cannot be deleted or have PIN changed via this interface">
                                                        <Lock className="w-3 h-3 text-gray-400" />
                                                    </div>
                                                )}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>

            {/* Edit Permissions Dialog */}
            <Dialog open={!!editingUser && !isChangePinOpen && !userToDelete} onOpenChange={(open) => !open && setEditingUser(null)}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>
                            {language === 'ar' ? 'تعديل صلاحيات المستخدم' : 'Edit User Permissions'}
                        </DialogTitle>
                        <DialogDescription>
                            {language === 'ar'
                                ? `تعديل الصلاحيات الممنوحة لـ ${editingUser?.name}`
                                : `Modify permissions granted to ${editingUser?.name}`}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        {renderPermissionsList(editPermissions, (permCode, checked) => {
                            if (checked) {
                                setEditPermissions(prev => [...prev, permCode]);
                            } else {
                                setEditPermissions(prev => prev.filter(c => c !== permCode));
                            }
                        })}
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditingUser(null)}>
                            {language === 'ar' ? 'إلغاء' : 'Cancel'}
                        </Button>
                        <Button onClick={handleSavePermissions} disabled={isSavingPerms}>
                            {isSavingPerms && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            {language === 'ar' ? 'حفظ التغييرات' : 'Save Changes'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Change PIN Dialog */}
            <Dialog open={isChangePinOpen} onOpenChange={setIsChangePinOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{language === 'ar' ? 'تغيير كلمة المرور' : 'Change Password'}</DialogTitle>
                        <DialogDescription>
                            {language === 'ar'
                                ? `تغيير كلمة المرور للمستخدم: ${userToChangePin?.name}`
                                : `Change password for user: ${userToChangePin?.name}`}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>{language === 'ar' ? 'كلمة المرور القديمة' : 'Old Password'}</Label>
                            <Input
                                type="password"
                                value={oldPin}
                                onChange={(e) => setOldPin(e.target.value)}
                                placeholder="****"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>{language === 'ar' ? 'كلمة المرور الجديدة' : 'New Password'}</Label>
                            <Input
                                type="password"
                                value={newPin}
                                onChange={(e) => setNewPin(e.target.value)}
                                placeholder="****"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsChangePinOpen(false)}>
                            {language === 'ar' ? 'إلغاء' : 'Cancel'}
                        </Button>
                        <Button onClick={handleSubmitChangePin} disabled={isChangingPin}>
                            {isChangingPin && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            {language === 'ar' ? 'حفظ التغييرات' : 'Save Changes'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <AlertDialog open={!!userToDelete} onOpenChange={(open) => !open && setUserToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{language === 'ar' ? 'هل أنت متأكد؟' : 'Are you sure?'}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {language === 'ar'
                                ? `سيتم حذف المستخدم "${userToDelete?.name}" نهائياً. لا يمكن التراجع عن هذا الإجراء.`
                                : `User "${userToDelete?.name}" will be permanently deleted. This action cannot be undone.`}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>{language === 'ar' ? 'إلغاء' : 'Cancel'}</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmDeleteUser} className="bg-destructive hover:bg-destructive/90" disabled={isDeletingUser}>
                            {isDeletingUser && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            {language === 'ar' ? 'حذف' : 'Delete'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </Card>
    );
};

export default UserManagementTab;
