
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
        const result = await window.electron.ipcRenderer.invoke('lab:get-orders');
        return result || [];
    } catch (error) {
        console.error('Failed to get lab orders:', error);
        return [];
    }
};

export const getLabs = async (): Promise<Lab[]> => {
    try {
        // @ts-ignore
        const result = await window.electron.ipcRenderer.invoke('lab:get-labs');
        return result || [];
    } catch (error) {
        console.error('Failed to get labs:', error);
        return [];
    }
};

export const createLab = async (data: { name: string, is_default: boolean }) => {
    try {
        // @ts-ignore
        return await window.electron.ipcRenderer.invoke('lab:create-lab', data);
    } catch (error) {
        console.error('Failed to create lab:', error);
        return { success: false, error };
    }
};

export const deleteLab = async (labId: string) => {
    try {
        // @ts-ignore
        return await window.electron.ipcRenderer.invoke('lab:delete-lab', labId);
    } catch (error) {
        console.error('Failed to delete lab:', error);
        return { success: false, error };
    }
};

export const getLabServices = async (labId?: string): Promise<LabService[]> => {
    try {
        // @ts-ignore
        const result = await window.electron.ipcRenderer.invoke('lab:get-services', labId);
        return result || [];
    } catch (error) {
        console.error('Failed to get lab services:', error);
        return [];
    }
};

export const getAllLabServices = async (): Promise<LabService[]> => {
    try {
        // @ts-ignore
        const result = await window.electron.ipcRenderer.invoke('lab:get-all-services');
        return result || [];
    } catch (error) {
        console.error('Failed to get all lab services:', error);
        return [];
    }
};

export const createLabService = async (data: Omit<LabService, 'id'>) => {
    try {
        // @ts-ignore
        return await window.electron.ipcRenderer.invoke('lab:create-service', data);
    } catch (error) {
        console.error('Failed to create lab service:', error);
        return { success: false, error };
    }
};

export const updateLabService = async (data: LabService) => {
    try {
        // @ts-ignore
        return await window.electron.ipcRenderer.invoke('lab:update-service', data);
    } catch (error) {
        console.error('Failed to update lab service:', error);
        return { success: false, error };
    }
};

export const createLabOrder = async (data: any) => {
    try {
        // @ts-ignore
        return await window.electron.ipcRenderer.invoke('lab:create-order', data);
    } catch (error) {
        console.error('Failed to create lab order:', error);
        return { success: false, error };
    }
};

export const receiveLabOrder = async (data: { orderId: string, receivedDate: string, paidAmount: number }) => {
    try {
        // @ts-ignore
        return await window.electron.ipcRenderer.invoke('lab:receive-order', data);
    } catch (error) {
        console.error('Failed to receive lab order:', error);
        return { success: false, error };
    }
};

export const deleteLabOrder = async (orderId: string, deleteExpenses: boolean) => {
    try {
        // @ts-ignore
        return await window.electron.ipcRenderer.invoke('lab:delete-order', { orderId, deleteExpenses });
    } catch (error) {
        console.error('Failed to delete lab order:', error);
        return { success: false, error };
    }
};

export const createLabGeneralPayment = async (data: { labId: string, amount: number, notes?: string, paymentDate: string }) => {
    try {
        // @ts-ignore
        return await window.electron.ipcRenderer.invoke('lab:create-general-payment', data);
    } catch (error) {
        console.error('Failed to create lab general payment:', error);
        return { success: false, error };
    }
};
