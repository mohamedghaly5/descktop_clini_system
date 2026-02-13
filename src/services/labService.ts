
import axios from 'axios';

export interface LabOrderOverview {
    order_id: string;
    patient_id: string;
    patient_name: string;
    doctor_id: string;
    doctor_name: string;
    lab_service_id: string;
    service_name: string;
    lab_id?: string;
    lab_name?: string;
    clinic_id: string;
    sent_date: string;
    expected_receive_date: string;
    received_date?: string;
    order_status: 'in_progress' | 'received' | 'late';
    total_lab_cost: number;
    total_paid: number;
    remaining_balance: number;
    created_at: string;
}

export interface LabService {
    id: string;
    name: string;
    default_cost: number;
    is_active: number;
    lab_id?: string;
}

export interface Lab {
    id: string;
    name: string;
    is_default: number;
}

export const getLabOrders = async (): Promise<LabOrderOverview[]> => {
    try {
        // @ts-ignore
        if ((window as any).electron) {
            const result = await window.electron.ipcRenderer.invoke('lab:get-orders');
            return result || [];
        }

        let serverUrl = localStorage.getItem('server_url') || '';
        if (!serverUrl && typeof window !== 'undefined' && window.location.protocol.startsWith('http')) {
            serverUrl = window.location.origin;
        }
        if (serverUrl) {
            const res = await axios.get(`${serverUrl}/api/labs/orders`, { headers: { Authorization: `Bearer ${(localStorage.getItem('session_token') || sessionStorage.getItem('session_token'))}` } });
            return res.data || [];
        }
        return [];
    } catch (error) {
        console.error('Failed to get lab orders:', error);
        return [];
    }
};

export const getLabs = async (): Promise<Lab[]> => {
    try {
        // @ts-ignore
        if ((window as any).electron) {
            const result = await window.electron.ipcRenderer.invoke('lab:get-labs');
            return result || [];
        }

        let serverUrl = localStorage.getItem('server_url') || '';
        if (!serverUrl && typeof window !== 'undefined' && window.location.protocol.startsWith('http')) {
            serverUrl = window.location.origin;
        }
        if (serverUrl) {
            const res = await axios.get(`${serverUrl}/api/labs/list`, { headers: { Authorization: `Bearer ${(localStorage.getItem('session_token') || sessionStorage.getItem('session_token'))}` } });
            return res.data || [];
        }
        return [];
    } catch (error) {
        console.error('Failed to get labs:', error);
        return [];
    }
};

export const createLab = async (data: { name: string, is_default: boolean }) => {
    try {
        // @ts-ignore
        if ((window as any).electron) {
            return await window.electron.ipcRenderer.invoke('lab:create-lab', data);
        }

        let serverUrl = localStorage.getItem('server_url') || '';
        if (!serverUrl && typeof window !== 'undefined' && window.location.protocol.startsWith('http')) {
            serverUrl = window.location.origin;
        }
        if (serverUrl) {
            const res = await axios.post(`${serverUrl}/api/labs`, data, { headers: { Authorization: `Bearer ${(localStorage.getItem('session_token') || sessionStorage.getItem('session_token'))}` } });
            return res.data;
        }

        return { success: false, error: 'Server URL not configured' };
    } catch (error) {
        console.error('Failed to create lab:', error);
        return { success: false, error: (error as any).message || String(error) };
    }
};

export const deleteLab = async (labId: string) => {
    try {
        // @ts-ignore
        if ((window as any).electron) {
            return await window.electron.ipcRenderer.invoke('lab:delete-lab', labId);
        }

        let serverUrl = localStorage.getItem('server_url') || '';
        if (!serverUrl && typeof window !== 'undefined' && window.location.protocol.startsWith('http')) {
            serverUrl = window.location.origin;
        }
        if (serverUrl) {
            const res = await axios.delete(`${serverUrl}/api/labs/${labId}`, { headers: { Authorization: `Bearer ${(localStorage.getItem('session_token') || sessionStorage.getItem('session_token'))}` } });
            return res.data;
        }

        return { success: false, error: 'Server URL not configured' };
    } catch (error) {
        console.error('Failed to delete lab:', error);
        return { success: false, error: (error as any).message || String(error) };
    }
};

export const getLabServices = async (labId?: string): Promise<LabService[]> => {
    if (!labId) return [];
    try {
        // @ts-ignore
        if ((window as any).electron) {
            const result = await window.electron.ipcRenderer.invoke('lab:get-services', labId);
            return result || [];
        }

        let serverUrl = localStorage.getItem('server_url') || '';
        if (!serverUrl && typeof window !== 'undefined' && window.location.protocol.startsWith('http')) {
            serverUrl = window.location.origin;
        }
        if (serverUrl) {
            const res = await axios.get(`${serverUrl}/api/labs/services`, { params: { labId }, headers: { Authorization: `Bearer ${(localStorage.getItem('session_token') || sessionStorage.getItem('session_token'))}` } });
            return res.data || [];
        }
        return [];
    } catch (error) {
        console.error('Failed to get lab services:', error);
        return [];
    }
};

export const getAllLabServices = async (): Promise<LabService[]> => {
    try {
        // @ts-ignore
        if ((window as any).electron) {
            const result = await window.electron.ipcRenderer.invoke('lab:get-all-services');
            return result || [];
        }

        let serverUrl = localStorage.getItem('server_url') || '';
        if (!serverUrl && typeof window !== 'undefined' && window.location.protocol.startsWith('http')) {
            serverUrl = window.location.origin;
        }
        if (serverUrl) {
            const res = await axios.get(`${serverUrl}/api/labs/services`, { headers: { Authorization: `Bearer ${(localStorage.getItem('session_token') || sessionStorage.getItem('session_token'))}` } });
            return res.data || [];
        }
        return [];
    } catch (error) {
        console.error('Failed to get all lab services:', error);
        return [];
    }
};

export const createLabService = async (data: Omit<LabService, 'id'>) => {
    try {
        // @ts-ignore
        if ((window as any).electron) {
            return await window.electron.ipcRenderer.invoke('lab:create-service', data);
        }

        let serverUrl = localStorage.getItem('server_url') || '';
        if (!serverUrl && typeof window !== 'undefined' && window.location.protocol.startsWith('http')) {
            serverUrl = window.location.origin;
        }
        if (serverUrl) {
            const res = await axios.post(`${serverUrl}/api/labs/services`, data, { headers: { Authorization: `Bearer ${(localStorage.getItem('session_token') || sessionStorage.getItem('session_token'))}` } });
            return res.data;
        }

        return { success: false, error: 'Server URL not configured' };
    } catch (error) {
        console.error('Failed to create lab service:', error);
        return { success: false, error: (error as any).message || String(error) };
    }
};

export const updateLabService = async (data: LabService) => {
    try {
        // @ts-ignore
        if ((window as any).electron) {
            return await window.electron.ipcRenderer.invoke('lab:update-service', data);
        }

        let serverUrl = localStorage.getItem('server_url') || '';
        if (!serverUrl && typeof window !== 'undefined' && window.location.protocol.startsWith('http')) {
            serverUrl = window.location.origin;
        }
        if (serverUrl) {
            const res = await axios.put(`${serverUrl}/api/labs/services/${data.id}`, data, { headers: { Authorization: `Bearer ${(localStorage.getItem('session_token') || sessionStorage.getItem('session_token'))}` } });
            return res.data;
        }

        return { success: false, error: 'Server URL not configured' };
    } catch (error) {
        console.error('Failed to update lab service:', error);
        return { success: false, error: (error as any).message || String(error) };
    }
};

export const createLabOrder = async (data: any) => {
    try {
        // @ts-ignore
        if ((window as any).electron) {
            return await window.electron.ipcRenderer.invoke('lab:create-order', data);
        }

        // Helper to resolve server URL (same as db.ts fallback)
        let serverUrl = localStorage.getItem('server_url') || '';
        if (!serverUrl && typeof window !== 'undefined' && window.location.protocol.startsWith('http')) {
            serverUrl = window.location.origin;
        }

        if (serverUrl) {
            const res = await axios.post(`${serverUrl}/api/labs/orders`, data, { headers: { Authorization: `Bearer ${(localStorage.getItem('session_token') || sessionStorage.getItem('session_token'))}` } });
            return res.data;
        }

        return { success: false, error: 'Server URL not configured' };
    } catch (error) {
        console.error('Failed to create lab order:', error);
        return { success: false, error: (error as any).message || String(error) };
    }
};

export const receiveLabOrder = async (data: { orderId: string, receivedDate: string, paidAmount: number }) => {
    try {
        // @ts-ignore
        if ((window as any).electron) {
            return await window.electron.ipcRenderer.invoke('lab:receive-order', data);
        }

        // Helper to resolve server URL
        let serverUrl = localStorage.getItem('server_url') || '';
        if (!serverUrl && typeof window !== 'undefined' && window.location.protocol.startsWith('http')) {
            serverUrl = window.location.origin;
        }

        if (serverUrl) {
            const res = await axios.post(`${serverUrl}/api/labs/orders/${data.orderId}/receive`, data, { headers: { Authorization: `Bearer ${(localStorage.getItem('session_token') || sessionStorage.getItem('session_token'))}` } });
            return res.data;
        }

        return { success: false, error: 'Server URL not configured' };
    } catch (error) {
        console.error('Failed to receive lab order:', error);
        return { success: false, error: (error as any).message || String(error) };
    }
};

export const deleteLabOrder = async (orderId: string, deleteExpenses: boolean) => {
    try {
        // @ts-ignore
        if ((window as any).electron) {
            return await window.electron.ipcRenderer.invoke('lab:delete-order', { orderId, deleteExpenses });
        }

        let serverUrl = localStorage.getItem('server_url') || '';
        if (!serverUrl && typeof window !== 'undefined' && window.location.protocol.startsWith('http')) {
            serverUrl = window.location.origin;
        }

        if (serverUrl) {
            await axios.delete(`${serverUrl}/api/labs/orders/${orderId}`, {
                params: { deleteExpenses },
                headers: { Authorization: `Bearer ${(localStorage.getItem('session_token') || sessionStorage.getItem('session_token'))}` }
            });
            return { success: true };
        }

        return { success: false, error: 'Server URL not configured' };
    } catch (error) {
        console.error('Failed to delete lab order:', error);
        return { success: false, error: (error as any).message || String(error) };
    }
};

export const createLabGeneralPayment = async (data: { labId: string, amount: number, notes?: string, paymentDate: string }) => {
    try {
        // @ts-ignore
        if ((window as any).electron) {
            return await window.electron.ipcRenderer.invoke('lab:create-general-payment', data);
        }

        // Helper to resolve server URL
        let serverUrl = localStorage.getItem('server_url') || '';
        if (!serverUrl && typeof window !== 'undefined' && window.location.protocol.startsWith('http')) {
            serverUrl = window.location.origin;
        }

        if (serverUrl) {
            const res = await axios.post(`${serverUrl}/api/labs/payments`, data, { headers: { Authorization: `Bearer ${(localStorage.getItem('session_token') || sessionStorage.getItem('session_token'))}` } });
            return res.data; // Expect { success: true, id: ... }
        }

        return { success: false, error: 'Server URL not configured' };
    } catch (error) {
        console.error('Failed to create lab general payment:', error);
        return { success: false, error: (error as any).message || String(error) };
    }
};
