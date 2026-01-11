import React, { useState } from 'react';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Edit, Trash2 } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from 'sonner';

interface Expense {
    id: string;
    amount: number;
    date: string;
    category: string;
    description: string;
}

interface ExpensesTableProps {
    expenses: Expense[];
    onEdit: (expense: Expense) => void;
    onRefresh: () => void;
}

const ExpensesTable: React.FC<ExpensesTableProps> = ({ expenses, onEdit, onRefresh }) => {
    const { t, isRTL } = useLanguage();

    const handleDelete = async (id: string) => {
        try {
            // @ts-ignore
            const result = await window.api.deleteExpense(id);
            if (result.success) {
                toast.success(t('expenses.toast.deleted'));
                onRefresh();
            } else {
                toast.error(t('error'));
            }
        } catch (error) {
            toast.error(t('error'));
        }
    };

    return (
        <div className="rounded-md border bg-card">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className={isRTL ? "text-right" : "text-left"}>{t('visitDate') || 'Date'}</TableHead>
                        <TableHead className={isRTL ? "text-right" : "text-left"}>{t('expenses.table.category')}</TableHead>
                        <TableHead className={isRTL ? "text-right" : "text-left"}>{t('notes') || 'Description'}</TableHead>
                        <TableHead className={isRTL ? "text-right" : "text-left"}>{t('expenses.table.amount')}</TableHead>
                        <TableHead className="w-[100px]">{t('expenses.table.actions')}</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {expenses.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                                {t('noResults')}
                            </TableCell>
                        </TableRow>
                    ) : (
                        expenses.map((expense) => (
                            <TableRow key={expense.id}>
                                <TableCell>{expense.date}</TableCell>
                                <TableCell>{t(`expenses.cat.${expense.category}` as any)}</TableCell>
                                <TableCell>{expense.description.replace(/\s*:?(Lab|lab):?\s*/g, '').trim()}</TableCell>
                                <TableCell className="font-medium text-destructive">
                                    {expense.amount.toFixed(2)}
                                </TableCell>
                                <TableCell>
                                    <div className="flex items-center gap-2">
                                        <Button variant="ghost" size="icon" onClick={() => onEdit(expense)}>
                                            <Edit className="w-4 h-4" />
                                        </Button>

                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive hover:bg-destructive/10">
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>{t('expenses.delete.title')}</AlertDialogTitle>
                                                    <AlertDialogDescription>
                                                        {t('expenses.delete.desc')}
                                                    </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
                                                    <AlertDialogAction onClick={() => handleDelete(expense.id)} className="bg-destructive hover:bg-destructive/90">
                                                        {t('delete')}
                                                    </AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))
                    )}
                </TableBody>
            </Table>
        </div>
    );
};

export default ExpensesTable;
