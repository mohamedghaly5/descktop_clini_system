import React, { useMemo } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign, Calendar, TrendingUp } from 'lucide-react';

interface Expense {
    id: string;
    amount: number;
    date: string;
}

interface ExpensesSummaryProps {
    expenses: Expense[];
}

const ExpensesSummary: React.FC<ExpensesSummaryProps> = ({ expenses }) => {
    const { t } = useLanguage();

    const summary = useMemo(() => {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const todayStr = `${year}-${month}-${day}`;

        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        const totals = {
            today: 0,
            month: 0,
            year: 0
        };

        expenses.forEach(exp => {
            // Parse as local start of day to avoid UTC shifts
            const expDate = new Date(exp.date + 'T00:00:00');
            const isToday = exp.date === todayStr;
            const isThisMonth = expDate.getMonth() === currentMonth && expDate.getFullYear() === currentYear;
            const isThisYear = expDate.getFullYear() === currentYear;

            if (isToday) totals.today += exp.amount;
            if (isThisMonth) totals.month += exp.amount;
            if (isThisYear) totals.year += exp.amount;
        });

        return totals;
    }, [expenses]);

    return (
        <div className="grid gap-4 md:grid-cols-3 mb-6">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">{t('expenses.summary.daily')}</CardTitle>
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{summary.today.toFixed(2)}</div>
                    <p className="text-xs text-muted-foreground">{t('expenses.summary.forToday')}</p>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">{t('expenses.summary.monthly')}</CardTitle>
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{summary.month.toFixed(2)}</div>
                    <p className="text-xs text-muted-foreground">{t('expenses.summary.currentMonth')}</p>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">{t('expenses.summary.yearly')}</CardTitle>
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{summary.year.toFixed(2)}</div>
                    <p className="text-xs text-muted-foreground">{t('expenses.summary.currentYear')}</p>
                </CardContent>
            </Card>
        </div>
    );
};

export default ExpensesSummary;
