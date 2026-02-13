import React, { useMemo } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useSettings } from '@/contexts/SettingsContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { LabOrderOverview } from '@/services/labService';
import { Wallet, Building, ArrowUpRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

// Interface duplicate removed
interface LabBalanceSummaryProps {
    orders: LabOrderOverview[];
    onRefresh?: () => void;
}

import RecordLabPaymentDialog from './RecordLabPaymentDialog';
import { CreditCard } from 'lucide-react';


interface LabSummary {
    labId: string;
    labName: string;
    totalDebt: number;
    count: number;
}

const LabBalanceSummary: React.FC<LabBalanceSummaryProps> = ({ orders, onRefresh }) => {
    const { t, language, isRTL } = useLanguage();
    const { hasPermission } = useAuth();
    const { formatCurrency } = useSettings();
    const [selectedLab, setSelectedLab] = React.useState<{ id: string, name: string } | null>(null);
    const [isPaymentOpen, setIsPaymentOpen] = React.useState(false);

    const handleRecordPayment = (labId: string, labName: string) => {
        setSelectedLab({ id: labId, name: labName });
        setIsPaymentOpen(true);
    };

    // 1. Calculate Total Outstanding Balance (Global)
    const totalBalance = useMemo(() => {
        return orders.reduce((sum, order) => sum + (order.remaining_balance || 0), 0);
    }, [orders]);

    // 2. Group by Lab
    const labSummaries = useMemo(() => {
        const map = new Map<string, LabSummary>();

        orders.forEach(order => {
            // Since we backfilled, lab_id should exist, but fallback safely
            const labId = order.lab_id || 'unknown';
            const labName = order.lab_name || 'Unknown Lab';
            const debt = order.remaining_balance || 0;

            if (debt > 0) { // Only track labs we owe money to
                if (!map.has(labId)) {
                    map.set(labId, { labId, labName, totalDebt: 0, count: 0 });
                }
                const current = map.get(labId)!;
                current.totalDebt += debt;
                current.count += 1;
            }
        });

        return Array.from(map.values()).sort((a, b) => b.totalDebt - a.totalDebt);
    }, [orders]);

    return (
        <div className="grid gap-6 md:grid-cols-2">
            {/* Total Summary Card */}
            <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border-blue-100 dark:border-blue-900">
                <CardHeader className="pb-2">
                    <CardTitle className="text-lg font-medium flex items-center gap-2 text-blue-700 dark:text-blue-300">
                        <Wallet className="h-5 w-5" />
                        {t('lab.summary.totalOutstanding') || 'Total Outstanding Balance'}
                    </CardTitle>
                    <CardDescription>
                        {t('lab.summary.totalDescription') || 'Total amount owed to all labs'}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="text-3xl font-bold text-blue-900 dark:text-blue-100 mb-2">
                        {formatCurrency(totalBalance, language)}
                    </div>
                </CardContent>
            </Card>

            {/* Per Lab Breakdown */}
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-lg font-medium flex items-center gap-2">
                        <Building className="h-5 w-5" />
                        {t('lab.summary.breakdown') || 'Balance by Lab'}
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {labSummaries.length === 0 ? (
                        <div className="text-center py-6 text-muted-foreground text-sm">
                            {t('lab.summary.noDebt') || 'No outstanding balances.'}
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {labSummaries.map((summary) => (
                                <div key={summary.labId} className="flex items-center justify-between">
                                    <div className="space-y-0.5">
                                        <div className="font-medium text-sm">{summary.labName}</div>
                                        <div className="text-xs text-muted-foreground">
                                            {summary.count} {t('lab.summary.orders') || 'active orders'}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="font-bold text-red-600 dark:text-red-400">
                                            {formatCurrency(summary.totalDebt, language)}
                                        </div>
                                        {hasPermission('LAB_PAYMENT') && (
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="h-7 text-xs gap-1"
                                                onClick={() => handleRecordPayment(summary.labId, summary.labName)}
                                            >
                                                <CreditCard className="h-3 w-3" />
                                                {t('lab.pay') || 'Pay'}
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            <RecordLabPaymentDialog
                open={isPaymentOpen}
                onOpenChange={setIsPaymentOpen}
                labName={selectedLab?.name || ''}
                labId={selectedLab?.id || ''}
                onSuccess={onRefresh || (() => { })}
            />
        </div>
    );
};

export default LabBalanceSummary;
