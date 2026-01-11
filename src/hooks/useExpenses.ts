import { useState, useEffect, useCallback } from 'react';

export interface Expense {
    id: string;
    amount: number;
    date: string; // YYYY-MM-DD
    category: string;
    description: string;
    created_at?: string;
}

export const useExpenses = () => {
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchExpenses = useCallback(async () => {
        setLoading(true);
        try {
            // @ts-ignore
            const result = await window.api.getExpenses();
            if (result.success && result.data) {
                setExpenses(result.data);
                setError(null);
            } else {
                setError(result.error || 'Failed to fetch expenses');
            }
        } catch (err: any) {
            console.error('Failed to fetch expenses', err);
            setError(err.message || 'Unknown error');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchExpenses();
    }, [fetchExpenses]);

    return { expenses, loading, error, refresh: fetchExpenses };
};
