import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Search, Filter } from 'lucide-react';
import ExpensesTable from '@/components/expenses/ExpensesTable';
import ExpensesSummary from '@/components/expenses/ExpensesSummary';
import ExpenseDialog from '@/components/expenses/ExpenseDialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Card, CardContent } from "@/components/ui/card";

import { useExpenses, Expense } from '@/hooks/useExpenses';
import { EXPENSE_CATEGORIES } from '@/constants/expenseCategories';
// ... other imports

const Expenses = () => {
    const { t, isRTL } = useLanguage();
    const { expenses, refresh: fetchExpenses } = useExpenses();
    const [filteredExpenses, setFilteredExpenses] = useState<Expense[]>([]);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingExpense, setEditingExpense] = useState<Expense | null>(null);

    // Filters
    const [dateRange, setDateRange] = useState<'all' | 'today' | 'week' | 'month'>('all');
    const [categoryFilter, setCategoryFilter] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [searchParams, setSearchParams] = useSearchParams();




    // Unique categories for filter
    // Use shared constant categories for filtering
    const categories = EXPENSE_CATEGORIES;

    useEffect(() => {
        let result = [...expenses];

        // Search
        if (searchTerm) {
            const lower = searchTerm.toLowerCase();
            result = result.filter(e =>
                e.description?.toLowerCase().includes(lower) ||
                e.category.toLowerCase().includes(lower)
            );
        }

        // Category Filter
        if (categoryFilter !== 'all') {
            result = result.filter(e => e.category === categoryFilter);
        }

        // Date Range
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const todayStr = `${year}-${month}-${day}`;

        if (dateRange === 'today') {
            result = result.filter(e => e.date === todayStr);
        } else if (dateRange === 'week') {
            const weekAgo = new Date();
            weekAgo.setHours(0, 0, 0, 0);
            weekAgo.setDate(weekAgo.getDate() - 7);
            result = result.filter(e => new Date(e.date + 'T00:00:00') >= weekAgo);
        } else if (dateRange === 'month') {
            const monthAgo = new Date();
            monthAgo.setHours(0, 0, 0, 0);
            monthAgo.setMonth(monthAgo.getMonth() - 1);
            result = result.filter(e => new Date(e.date + 'T00:00:00') >= monthAgo);
        }

        setFilteredExpenses(result);
    }, [expenses, searchTerm, categoryFilter, dateRange]);

    const handleAdd = () => {
        setEditingExpense(null);
        setIsDialogOpen(true);
    };

    // Auto-open dialog if query param action=add exists
    useEffect(() => {
        if (searchParams.get('action') === 'add') {
            handleAdd();
            // Remove param to prevent reopening on refresh
            const newParams = new URLSearchParams(searchParams);
            newParams.delete('action');
            setSearchParams(newParams);
        }
    }, [searchParams]);

    const handleEdit = (expense: Expense) => {
        setEditingExpense(expense);
        setIsDialogOpen(true);
    };

    return (
        <div className="container mx-auto p-6 space-y-6 animate-fade-in pb-20">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">{t('expenses.page.title')}</h1>
                    <p className="text-muted-foreground mt-1">{t('expenses.page.subtitle')}</p>
                </div>
                <Button onClick={handleAdd} className="gap-2">
                    <Plus className="w-4 h-4" />
                    {t('expenses.button.add')}
                </Button>
            </div>

            <ExpensesSummary expenses={expenses} />

            <Card>
                <CardContent className="p-4">
                    <div className="flex flex-col md:flex-row gap-4 mb-6">
                        <div className="relative flex-1">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder={t('expenses.search.placeholder')}
                                className={isRTL ? "pr-9 pl-3 text-right" : "pl-9"}
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>

                        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                            <SelectTrigger className="w-[180px]">
                                <Filter className="w-4 h-4 mr-2" />
                                <SelectValue placeholder={t('expenses.table.category')} />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">{t('expenses.filter.allCategories')}</SelectItem>
                                {categories.map(c => (
                                    <SelectItem key={c} value={c}>{t(`expenses.cat.${c}` as any)}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <Select value={dateRange} onValueChange={(val: any) => setDateRange(val)}>
                            <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder={t('expenses.filter.dateRange')} />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">{t('allTime')}</SelectItem>
                                <SelectItem value="today">{t('today')}</SelectItem>
                                <SelectItem value="week">{t('expenses.filter.last7Days')}</SelectItem>
                                <SelectItem value="month">{t('expenses.filter.last30Days')}</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <ExpensesTable
                        expenses={filteredExpenses}
                        onEdit={handleEdit}
                        onRefresh={fetchExpenses}
                    />
                </CardContent>
            </Card>

            <ExpenseDialog
                open={isDialogOpen}
                onOpenChange={setIsDialogOpen}
                expenseToEdit={editingExpense}
                onSave={fetchExpenses}
            />
        </div>
    );
};

export default Expenses;
