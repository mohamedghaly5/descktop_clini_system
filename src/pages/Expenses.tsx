import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useSettings } from '@/contexts/SettingsContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Search, Filter, DollarSign, Calendar, TrendingUp, Wallet, Edit, Trash2, ArrowRight } from 'lucide-react';
import ExpenseDialog from '@/components/expenses/ExpenseDialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from 'sonner';
import { db } from '@/services/db';

import { useExpenses, Expense } from '@/hooks/useExpenses';
import { EXPENSE_CATEGORIES } from '@/constants/expenseCategories';
import { cn } from '@/lib/utils';

const Expenses = () => {
    const { t, language, isRTL } = useLanguage();
    const { user } = useAuth();
    const { formatCurrency } = useSettings();
    const { expenses, refresh: fetchExpenses } = useExpenses();
    const [filteredExpenses, setFilteredExpenses] = useState<Expense[]>([]);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingExpense, setEditingExpense] = useState<Expense | null>(null);

    // Delete State
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [expenseToDelete, setExpenseToDelete] = useState<Expense | null>(null);

    // Filters
    const [dateRange, setDateRange] = useState<'all' | 'today' | 'week' | 'month'>('all');
    const [categoryFilter, setCategoryFilter] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [searchParams, setSearchParams] = useSearchParams();

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

        // Sort by date desc
        result.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

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
            const newParams = new URLSearchParams(searchParams);
            newParams.delete('action');
            setSearchParams(newParams);
        }
    }, [searchParams]);

    const handleEdit = (expense: Expense) => {
        setEditingExpense(expense);
        setIsDialogOpen(true);
    };

    const handleDeleteClick = (expense: Expense) => {
        setExpenseToDelete(expense);
        setDeleteConfirmOpen(true);
    };

    const confirmDelete = async () => {
        if (!expenseToDelete) return;

        try {
            const result = await db.expenses.delete(expenseToDelete.id);
            if (result.success) {
                toast.success(t('expenses.toast.deleted'));
                fetchExpenses();
            } else {
                toast.error(t('error'));
            }
        } catch (error) {
            toast.error(t('error'));
        } finally {
            setDeleteConfirmOpen(false);
            setExpenseToDelete(null);
        }
    };

    // Summary Calculations
    const summary = useMemo(() => {
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();
        const todayStr = now.toISOString().split('T')[0];

        const totals = {
            today: 0,
            month: 0,
            year: 0
        };

        expenses.forEach(exp => {
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
        <div className="container mx-auto p-4 md:p-6 space-y-6 animate-fade-in pb-20 bg-gradient-to-br from-indigo-50/50 to-purple-50/50 dark:from-gray-900 dark:to-gray-800 min-h-screen rounded-3xl">
            {/* Header */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-card/50 p-4 rounded-2xl border backdrop-blur-sm">
                <div className="flex items-center gap-3">
                    <div className="p-3 rounded-xl bg-gradient-to-br from-rose-500/10 to-orange-500/10 text-rose-600 ring-1 ring-rose-500/20 shadow-sm">
                        <Wallet className="w-8 h-8" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-foreground">
                            {language === 'ar' ? 'إدارة المصروفات' : 'Expenses Management'}
                        </h1>
                        <p className="text-sm text-muted-foreground">
                            {language === 'ar' ? 'تتبع وإدارة مصروفات العيادة' : 'Track and manage clinic expenses'}
                        </p>
                    </div>
                </div>

                {(user?.role === 'admin' || user?.permissions?.includes('ADD_EXPENSE')) && (
                    <Button
                        onClick={handleAdd}
                        className="w-full md:w-auto gap-2 shadow-lg shadow-rose-500/20 hover:shadow-rose-500/30 transition-all duration-300 bg-gradient-to-r from-rose-600 to-orange-600 hover:from-rose-700 hover:to-orange-700 text-white border-0"
                    >
                        <Plus className="w-5 h-5" />
                        {t('expenses.button.add')}
                    </Button>
                )}
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Daily */}
                <Card className="border-none shadow-sm hover:shadow-md transition-all duration-300 bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm overflow-hidden relative group">
                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                        <DollarSign className="w-24 h-24 text-blue-500" />
                    </div>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                            <DollarSign className="w-4 h-4 text-blue-500" />
                            {t('expenses.summary.daily')}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-blue-600 dark:text-blue-400 ltr-nums">
                            {formatCurrency(summary.today, language)}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded-full w-fit">
                            {t('expenses.summary.forToday')}
                        </p>
                    </CardContent>
                </Card>

                {/* Monthly */}
                <Card className="border-none shadow-sm hover:shadow-md transition-all duration-300 bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm overflow-hidden relative group">
                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                        <Calendar className="w-24 h-24 text-purple-500" />
                    </div>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-purple-500" />
                            {t('expenses.summary.monthly')}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-purple-600 dark:text-purple-400 ltr-nums">
                            {formatCurrency(summary.month, language)}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 bg-purple-50 dark:bg-purple-900/20 px-2 py-0.5 rounded-full w-fit">
                            {t('expenses.summary.currentMonth')}
                        </p>
                    </CardContent>
                </Card>

                {/* Yearly */}
                <Card className="border-none shadow-sm hover:shadow-md transition-all duration-300 bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm overflow-hidden relative group">
                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                        <TrendingUp className="w-24 h-24 text-rose-500" />
                    </div>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                            <TrendingUp className="w-4 h-4 text-rose-500" />
                            {t('expenses.summary.yearly')}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-rose-600 dark:text-rose-400 ltr-nums">
                            {formatCurrency(summary.year, language)}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 bg-rose-50 dark:bg-rose-900/20 px-2 py-0.5 rounded-full w-fit">
                            {t('expenses.summary.currentYear')}
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-4 items-center bg-background/50 p-1 rounded-xl">
                <div className="relative flex-1 w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder={t('expenses.search.placeholder')}
                        className={`h-11 bg-card border-transparent shadow-sm hover:bg-card/80 transition-colors ${isRTL ? "pr-10 pl-3 text-right" : "pl-10"}`}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger className="w-full md:w-[200px] h-11 bg-card border-transparent shadow-sm">
                        <Filter className="w-4 h-4 mr-2 text-muted-foreground" />
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
                    <SelectTrigger className="w-full md:w-[180px] h-11 bg-card border-transparent shadow-sm">
                        <Calendar className="w-4 h-4 mr-2 text-muted-foreground" />
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

            {/* Expenses List */}
            <Card className="border-none shadow-md bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm">
                <CardHeader>
                    <CardTitle className="text-lg font-bold flex items-center gap-2">
                        <div className="h-6 w-1 rounded-full bg-rose-500" />
                        {language === 'ar' ? 'سجل المصروفات' : 'Expenses Log'}
                        <span className="text-sm font-normal text-muted-foreground ml-2">({filteredExpenses.length})</span>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-3">
                        {filteredExpenses.length === 0 ? (
                            <div className="text-center py-20 bg-muted/20 rounded-xl border-2 border-dashed border-muted">
                                <Wallet className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
                                <p className="text-muted-foreground text-lg">
                                    {t('noResults')}
                                </p>
                            </div>
                        ) : (
                            filteredExpenses.map((expense) => (
                                <div key={expense.id} className="group flex flex-col sm:flex-row items-center gap-4 p-4 rounded-xl bg-card border hover:border-rose-500/30 hover:shadow-md transition-all duration-200">

                                    {/* Icon & Category */}
                                    <div className="flex items-center gap-4 w-full sm:w-auto sm:min-w-[200px]">
                                        <div className="w-10 h-10 rounded-full bg-rose-100 dark:bg-rose-900/30 text-rose-600 flex items-center justify-center shrink-0 shadow-sm">
                                            <ArrowRight className={`w-5 h-5 ${isRTL ? 'rotate-135' : '-rotate-45'}`} />
                                        </div>
                                        <div>
                                            <p className="font-bold text-foreground">{t(`expenses.cat.${expense.category}` as any)}</p>
                                            <p className="text-xs text-muted-foreground font-mono bg-muted/50 px-1.5 py-0.5 rounded w-fit mt-1">
                                                {expense.date}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Description */}
                                    <div className="flex-1 w-full text-center sm:text-start">
                                        <p className="text-sm text-muted-foreground line-clamp-2">
                                            {expense.description.replace(/\s*:?(Lab|lab):?\s*/g, '').trim() || '-'}
                                        </p>
                                    </div>

                                    {/* Amount & Actions */}
                                    <div className="flex items-center justify-between w-full sm:w-auto gap-6 sm:pl-4 sm:border-l">
                                        <div className="text-end">
                                            <div className="text-xs text-muted-foreground mb-1">
                                                {t('expenses.table.amount')}
                                            </div>
                                            <div className="text-lg font-bold text-rose-600 ltr-nums">
                                                {formatCurrency(expense.amount, language)}
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-1">
                                            {(user?.role === 'admin' || user?.permissions?.includes('EDIT_EXPENSE')) && (
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => handleEdit(expense)}
                                                    className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-full transition-colors"
                                                >
                                                    <Edit className="w-4 h-4" />
                                                </Button>
                                            )}
                                            {(user?.role === 'admin' || user?.permissions?.includes('DELETE_EXPENSE')) && (
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => handleDeleteClick(expense)}
                                                    className="h-8 w-8 text-destructive/70 hover:text-destructive hover:bg-destructive/10 rounded-full transition-colors"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            )}
                                        </div>
                                    </div>

                                </div>
                            ))
                        )}
                    </div>
                </CardContent>
            </Card>

            <ExpenseDialog
                open={isDialogOpen}
                onOpenChange={setIsDialogOpen}
                expenseToEdit={editingExpense}
                onSave={fetchExpenses}
            />

            <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t('expenses.delete.title')}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {expenseToDelete?.category === 'Lab'
                                ? (isRTL
                                    ? "سيتم حذف هذا السجل وإلغاء الدفع المرتبط به، وسيتم إعادة المبلغ إلى رصيد حساب المعمل."
                                    : "This record will be deleted and the associated payment cancelled. The amount will be added back to the Lab's balance.")
                                : t('expenses.delete.desc')
                            }
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmDelete} className="bg-destructive hover:bg-destructive/90">
                            {t('delete')}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
};

export default Expenses;
