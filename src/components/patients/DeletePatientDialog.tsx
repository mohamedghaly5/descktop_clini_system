import React, { useState } from 'react';
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
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { AlertTriangle, Calendar, FileText, Briefcase } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';

export interface DeletePatientStats {
    appointmentsCount: number;
    invoicesCount: number;
    treatmentCasesCount: number;
}

export interface DeletePatientOptions {
    deleteAppointments: boolean;
    deleteTreatmentCases: boolean;
    deleteInvoices: boolean;
}

interface DeletePatientDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    patientName: string;
    stats: DeletePatientStats;
    onConfirm: (options: DeletePatientOptions) => void;
}

export const DeletePatientDialog: React.FC<DeletePatientDialogProps> = ({
    open,
    onOpenChange,
    patientName,
    stats,
    onConfirm,
}) => {
    const { language, isRTL } = useLanguage();

    const [options, setOptions] = useState<DeletePatientOptions>({
        deleteAppointments: false,
        deleteTreatmentCases: false,
        deleteInvoices: false,
    });

    const handleConfirm = () => {
        onConfirm(options);
        // Reset options after confirm
        setOptions({
            deleteAppointments: false,
            deleteTreatmentCases: false,
            deleteInvoices: false,
        });
    };

    const handleCancel = () => {
        onOpenChange(false);
        // Reset options on cancel
        setOptions({
            deleteAppointments: false,
            deleteTreatmentCases: false,
            deleteInvoices: false,
        });
    };

    const hasRelatedData = stats.appointmentsCount > 0 || stats.invoicesCount > 0 || stats.treatmentCasesCount > 0;
    const willDeleteData = options.deleteAppointments || options.deleteTreatmentCases || options.deleteInvoices;

    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogContent className="sm:max-w-[500px]" dir={isRTL ? 'rtl' : 'ltr'}>
                <AlertDialogHeader>
                    <AlertDialogTitle className={cn("flex items-center gap-2", isRTL && "flex-row-reverse")}>
                        <AlertTriangle className="w-5 h-5 text-destructive" />
                        {language === 'ar' ? 'هل تريد حذف هذا المريض؟' : 'Delete this patient?'}
                    </AlertDialogTitle>
                    <AlertDialogDescription className={isRTL ? "text-right" : "text-left"}>
                        {language === 'ar'
                            ? `سيتم حذف المريض "${patientName}" من قائمة المرضى.`
                            : `Patient "${patientName}" will be removed from the patients list.`
                        }
                    </AlertDialogDescription>
                </AlertDialogHeader>

                {hasRelatedData && (
                    <div className="space-y-4 py-4">
                        {/* Warning Banner */}
                        <div className="bg-warning/10 border border-warning/30 rounded-lg p-3">
                            <p className={cn("text-sm text-warning font-medium", isRTL && "text-right")}>
                                {language === 'ar'
                                    ? 'هذا المريض لديه بيانات مرتبطة. اختر ما تريد حذفه:'
                                    : 'This patient has related data. Choose what to delete:'
                                }
                            </p>
                        </div>

                        {/* Appointments Toggle */}
                        {stats.appointmentsCount > 0 && (
                            <div className={cn(
                                "flex items-center justify-between p-3 border rounded-lg",
                                options.deleteAppointments && "border-destructive bg-destructive/5",
                                isRTL && "flex-row-reverse"
                            )}>
                                <div className={cn("flex items-center gap-3", isRTL && "flex-row-reverse")}>
                                    <Calendar className="w-5 h-5 text-primary" />
                                    <div className={isRTL ? "text-right" : "text-left"}>
                                        <Label className="font-medium">
                                            {language === 'ar' ? 'المواعيد' : 'Appointments'}
                                        </Label>
                                        <p className="text-sm text-muted-foreground">
                                            {language === 'ar'
                                                ? `سيتم حذف ${stats.appointmentsCount} موعد`
                                                : `${stats.appointmentsCount} appointment(s) will be deleted`
                                            }
                                        </p>
                                    </div>
                                </div>
                                <Switch
                                    checked={options.deleteAppointments}
                                    onCheckedChange={(checked) => setOptions(prev => ({ ...prev, deleteAppointments: checked }))}
                                />
                            </div>
                        )}

                        {/* Treatment Cases Toggle */}
                        {stats.treatmentCasesCount > 0 && (
                            <div className={cn(
                                "flex items-center justify-between p-3 border rounded-lg",
                                options.deleteTreatmentCases && "border-destructive bg-destructive/5",
                                isRTL && "flex-row-reverse"
                            )}>
                                <div className={cn("flex items-center gap-3", isRTL && "flex-row-reverse")}>
                                    <Briefcase className="w-5 h-5 text-primary" />
                                    <div className={isRTL ? "text-right" : "text-left"}>
                                        <Label className="font-medium">
                                            {language === 'ar' ? 'خطط العلاج' : 'Treatment Plans'}
                                        </Label>
                                        <p className="text-sm text-muted-foreground">
                                            {language === 'ar'
                                                ? `سيتم حذف ${stats.treatmentCasesCount} خطة علاج`
                                                : `${stats.treatmentCasesCount} treatment plan(s) will be deleted`
                                            }
                                        </p>
                                    </div>
                                </div>
                                <Switch
                                    checked={options.deleteTreatmentCases}
                                    onCheckedChange={(checked) => setOptions(prev => ({ ...prev, deleteTreatmentCases: checked }))}
                                />
                            </div>
                        )}

                        {/* Invoices Toggle */}
                        {stats.invoicesCount > 0 && (
                            <div className={cn(
                                "flex items-center justify-between p-3 border rounded-lg",
                                options.deleteInvoices && "border-destructive bg-destructive/5",
                                isRTL && "flex-row-reverse"
                            )}>
                                <div className={cn("flex items-center gap-3", isRTL && "flex-row-reverse")}>
                                    <FileText className="w-5 h-5 text-accent" />
                                    <div className={isRTL ? "text-right" : "text-left"}>
                                        <Label className="font-medium">
                                            {language === 'ar' ? 'الفواتير' : 'Invoices'}
                                        </Label>
                                        <p className="text-sm text-muted-foreground">
                                            {language === 'ar'
                                                ? `سيتم حذف ${stats.invoicesCount} فاتورة`
                                                : `${stats.invoicesCount} invoice(s) will be deleted`
                                            }
                                        </p>
                                    </div>
                                </div>
                                <Switch
                                    checked={options.deleteInvoices}
                                    onCheckedChange={(checked) => setOptions(prev => ({ ...prev, deleteInvoices: checked }))}
                                />
                            </div>
                        )}

                        {/* Financial Warning */}
                        {willDeleteData && (
                            <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3">
                                <p className={cn("text-sm text-destructive font-medium", isRTL && "text-right")}>
                                    {language === 'ar'
                                        ? '⚠️ تحذير: حذف الفواتير أو خطط العلاج قد يؤثر على التقارير المالية!'
                                        : '⚠️ Warning: Deleting invoices or treatment plans may affect financial reports!'
                                    }
                                </p>
                            </div>
                        )}
                    </div>
                )}

                {!hasRelatedData && (
                    <div className="py-4">
                        <p className={cn("text-sm text-muted-foreground", isRTL && "text-right")}>
                            {language === 'ar'
                                ? 'لا توجد بيانات مرتبطة بهذا المريض. سيتم حذفه من القائمة فقط.'
                                : 'No related data for this patient. They will only be removed from the list.'
                            }
                        </p>
                    </div>
                )}

                <AlertDialogFooter className={cn(isRTL && "flex-row-reverse gap-2")}>
                    <AlertDialogCancel onClick={handleCancel}>
                        {language === 'ar' ? 'إلغاء' : 'Cancel'}
                    </AlertDialogCancel>
                    <AlertDialogAction
                        onClick={handleConfirm}
                        className="bg-destructive hover:bg-destructive/90"
                    >
                        {language === 'ar' ? 'حذف المريض' : 'Delete Patient'}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
};

export default DeletePatientDialog;
