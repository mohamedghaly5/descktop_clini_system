import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

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
            if ((window as any).api && (window as any).api.getExpenses) {
                // @ts-ignore
                const result = await window.api.getExpenses();
                if (result.success && result.data) {
                    setExpenses(result.data);
                    setError(null);
                } else {
                    setError(result.error || 'Failed to fetch expenses');
                }
            } else {
                // Client Mode
                const serverUrl = localStorage.getItem('server_url');
                if (serverUrl) {
                    const token = localStorage.getItem('session_token') || sessionStorage.getItem('session_token');
                    const res = await axios.get(`${serverUrl}/api/expenses`, {
                        headers: { Authorization: `Bearer ${token}` }
                    });

                    if (res.data.success && res.data.data) {
                        setExpenses(res.data.data);
                    } else if (Array.isArray(res.data)) {
                        setExpenses(res.data);
                    } else {
                        setExpenses([]);
                    }
                    setError(null);
                }
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
