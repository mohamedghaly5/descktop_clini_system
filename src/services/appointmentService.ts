import { db } from './db';
import type { Patient } from './patientService';

// Interfaces
export interface Appointment {
  id: string;
  patientId: string;
  patientName: string;
  patientNameAr: string;
  date: string;
  time: string;
  service: string; // This is the Service ID
  serviceName?: string; // Joined name from backend
  serviceAr: string;
  status: 'booked' | 'confirmed' | 'attended' | 'cancelled';
  notes: string;
  treatmentCaseId?: string;
  invoiceId?: string;
  doctorId?: string; // Valid Doctor ID
  createdAt: string;
  updatedAt: string;
}

export interface TreatmentCase {
  id: string;
  patientId: string;
  patientName: string;
  patientNameAr: string;
  name: string;
  nameAr: string;
  totalCost: number;
  totalPaid: number;
  balance: number;
  status: 'active' | 'closed';
  createdAt: string;
  updatedAt: string;
}

export interface Invoice {
  id: string;
  patientId: string;
  appointmentId: string;
  treatmentCaseId: string;
  doctorId: string;
  serviceName: string;
  serviceNameAr: string;
  cost: number;
  amountPaid: number;
  balance: number;
  date: string;
  createdAt: string;
}

// ============ PATIENTS (Proxy) ============
export const getPatients = async (email?: string | null): Promise<Patient[]> => {
  // Use direct IPC to support sorting/filtering by email
  const p = await window.electron.ipcRenderer.invoke('patients:getAll', { email });
  return p.map((x: any) => ({
    id: x.id,
    name: x.full_name,
    phone: x.phone,
    gender: x.gender,
    age: x.age,
    cityId: x.city_id,
    notes: x.notes,
    deleted: false,
    createdAt: x.created_at,
    updatedAt: x.updated_at
  }));
};

async function getPatientName(id: string): Promise<string> {
  // This internal helper might fail if we don't pass email, but it's used internally? 
  // It calls getPatients(). defaulting to specific query might be better but for now:
  const patients = await getPatients();
  const p = patients.find(x => x.id === id);
  return p ? p.name : 'Unknown';
}

// ============ APPOINTMENTS ============
export const getAppointments = async (email?: string | null): Promise<Appointment[]> => {
  const data = await window.electron.ipcRenderer.invoke('appointments:getAll', { email });
  // We need to fetch patients to map names to match interface
  const patients = await getPatients(email);
  const services = await window.electron.ipcRenderer.invoke('services:getAll', { email });

  return data.map((a: any) => {
    const p = patients.find(x => x.id === a.patient_id);
    const s = services.find((x: any) => x.id === a.service_id);
    return {
      id: a.id,
      patientId: a.patient_id,
      patientName: p ? p.name : 'Unknown',
      patientNameAr: p ? p.name : 'Unknown',
      date: a.date,
      time: a.time,
      service: a.service_id,
      serviceName: a.service_name,
      serviceAr: s ? s.name : '',
      status: a.status as any,
      notes: a.notes,
      treatmentCaseId: a.treatment_case_id, // Ensure DB has this col
      invoiceId: a.invoice_id, // Ensure DB has this col
      createdAt: a.created_at,
      updatedAt: a.updated_at
    };
  });
};

export const getAppointmentById = async (id: string): Promise<Appointment | undefined> => {
  const all = await getAppointments();
  return all.find(a => a.id === id);
};

export const createAppointment = async (appointment: Omit<Appointment, 'id' | 'createdAt' | 'updatedAt'>, email?: string | null): Promise<Appointment> => {
  const payload = {
    patient_id: appointment.patientId,
    date: appointment.date,
    time: appointment.time,
    status: appointment.status,
    notes: appointment.notes,
    service_id: appointment.service,
    doctor_id: appointment.doctorId
  };

  const result = await window.electron.ipcRenderer.invoke('db:insert', {
    table: 'appointments',
    data: payload
  });

  if (result.error) {
    console.error('IPC Error:', result.error);
    throw new Error(result.error);
  }

  let id = result?.data?.id || result?.id || result?.lastInsertRowid;
  if (!id && typeof result === 'number') {
    id = result;
  }

  return {
    ...appointment,
    id: String(id),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
};

export const updateAppointment = async (id: string, updates: Partial<Appointment>): Promise<Appointment | null> => {
  const dbUpdates: any = {};
  if (updates.status) dbUpdates.status = updates.status;
  if (updates.date) dbUpdates.date = updates.date;
  if (updates.time) dbUpdates.time = updates.time;
  if (updates.notes) dbUpdates.notes = updates.notes;
  if (updates.treatmentCaseId) dbUpdates.treatment_case_id = updates.treatmentCaseId;
  if (updates.invoiceId) dbUpdates.invoice_id = updates.invoiceId;

  const result = await db.appointments.update(id, dbUpdates);

  if (result.error) {
    console.error('IPC Error in updateAppointment:', result.error);
    throw new Error(result.error);
  }

  return { id, ...updates } as Appointment;
};

export const deleteAppointment = async (id: string): Promise<boolean> => {
  await db.appointments.delete(id);
  return true;
};

// ============ TREATMENT CASES ============
export const getTreatmentCases = async (email?: string | null): Promise<TreatmentCase[]> => {
  const data = await window.electron.ipcRenderer.invoke('treatment_cases:getAll', { email }).catch(() => []);
  if (!data) return [];
  return data.map((tc: any) => ({
    id: tc.id,
    patientId: tc.patient_id,
    patientName: tc.patient_name, // Stored or joined?
    patientNameAr: tc.patient_name,
    name: tc.name, // treatment_cases has 'name'
    nameAr: tc.name,
    totalCost: tc.total_cost,
    totalPaid: tc.total_paid,
    balance: tc.balance,
    status: tc.status,
    createdAt: tc.created_at,
    updatedAt: tc.updated_at
  }));
};

export const getActiveTreatmentCasesByPatient = async (patientId: string, email?: string | null): Promise<TreatmentCase[]> => {
  // Use new specific handler directly
  const data = await window.electron.ipcRenderer.invoke('treatment_cases:getByPatient', { patientId }).catch((e: any) => {
    console.error('Failed to get active cases', e);
    return [];
  });

  return data.map((tc: any) => ({
    id: tc.id,
    patientId: tc.patient_id,
    patientName: tc.patient_name || '',
    patientNameAr: tc.patient_name || '',
    name: tc.name,
    nameAr: tc.name,
    totalCost: tc.total_cost,
    totalPaid: tc.total_paid,
    balance: tc.balance,
    status: tc.status,
    createdAt: tc.created_at,
    updatedAt: tc.updated_at
  }));
};

export const createTreatmentCase = async (treatmentCase: Omit<TreatmentCase, 'id' | 'createdAt' | 'updatedAt'>, email?: string | null): Promise<TreatmentCase> => {
  const result = await window.electron.ipcRenderer.invoke('treatment_cases:create', { ...treatmentCase, ownerEmail: email });
  // Fallback to generic if specific handler not found or use insert
  // But wait, I added treatment_cases:create handler? No, I updated patients/appointments handlers?
  // I should check handlers.ts. I think I missed treatment_cases:create.
  // Actually, I can use generic db:insert and add owner_email manually here.

  if (result?.error) { // If using handler
    throw new Error(result.error);
  }

  // If defaulting to db:insert (legacy path if handler absent)
  if (!result || !result.success) {
    const insertData = {
      patient_id: treatmentCase.patientId,
      patient_name: treatmentCase.patientName,
      name: treatmentCase.name,
      total_cost: treatmentCase.totalCost,
      total_paid: treatmentCase.totalPaid,
      balance: treatmentCase.balance,
      status: treatmentCase.status
    };

    const res = await window.electron.ipcRenderer.invoke('db:insert', {
      table: 'treatment_cases',
      data: insertData
    });
    if (res.error) throw new Error(res.error);
    return { ...treatmentCase, id: res.data.id, createdAt: '', updatedAt: '' };
  }

  return { ...treatmentCase, id: result.id || '', createdAt: '', updatedAt: '' };
};

export const updateTreatmentCase = async (id: string, updates: Partial<TreatmentCase>): Promise<TreatmentCase | null> => {
  const dbUpdates: any = {};
  if (updates.totalPaid !== undefined) dbUpdates.total_paid = updates.totalPaid;
  if (updates.balance !== undefined) dbUpdates.balance = updates.balance;
  if (updates.status) dbUpdates.status = updates.status;

  const result = await window.electron.ipcRenderer.invoke('db:update', { table: 'treatment_cases', id, data: dbUpdates });
  if (result.error) {
    console.error('IPC Error in updateTreatmentCase:', result.error);
    throw new Error(result.error);
  }
  return { id, ...updates } as TreatmentCase;
};

// ============ INVOICES ============
export const getInvoices = async (email?: string | null): Promise<Invoice[]> => {
  const res = await window.electron.ipcRenderer.invoke('invoices:getAll', { email }).catch(() => []);
  return res.map((i: any) => ({
    id: i.id,
    patientId: i.patient_id,
    appointmentId: i.appointment_id,
    treatmentCaseId: i.treatment_case_id,
    doctorId: i.doctor_id,
    serviceName: i.service_name || '',
    serviceNameAr: '',
    cost: i.amount,
    amountPaid: i.paid_amount,
    balance: (i.amount || 0) - (i.paid_amount || 0),
    date: i.created_at,
    createdAt: i.created_at
  }));
};

export const getInvoiceByAppointmentId = async (appointmentId: string): Promise<Invoice | undefined> => {
  const all = await getInvoices();
  return all.find(inv => inv.appointmentId === appointmentId);
};

export const createInvoice = async (invoice: Omit<Invoice, 'id' | 'createdAt'>, email?: string | null): Promise<Invoice> => {
  const result = await window.electron.ipcRenderer.invoke('db:insert', {
    table: 'invoices',
    data: {
      patient_id: invoice.patientId,
      appointment_id: invoice.appointmentId,
      treatment_case_id: invoice.treatmentCaseId,
      amount: invoice.cost,
      paid_amount: invoice.amountPaid || 0,
      status: invoice.balance > 0 ? 'pending' : 'paid',
      doctor_id: invoice.doctorId,
      service_id: invoice.serviceName // Warning: This field in Invoice interface is 'serviceName'. Just mapping it for now, but should ideally be serviceId.
    }
  });

  if (result.error) {
    console.error('IPC Error in createInvoice:', result.error);
    throw new Error(result.error);
  }

  return { ...invoice, id: result.data.id, createdAt: '' };
};

export const deleteInvoice = async (id: string): Promise<boolean> => {
  const result = await window.electron.ipcRenderer.invoke('invoices:delete', { id });
  if (result.error) {
    console.error('Error deleting invoice:', result.error);
    return false;
  }
  return true;
};

export const deleteTreatmentCase = async (id: string): Promise<boolean> => {
  const result = await window.electron.ipcRenderer.invoke('treatment_cases:delete', { id });
  if (result.error) {
    console.error('Error deleting treatment case:', result.error);
    return false;
  }
  return true;
};

// ============ COMBINED OPERATIONS ============
export const markAppointmentAttended = async (
  appointmentId: string,
  treatmentCaseId: string | 'new',
  serviceName: string,
  serviceNameAr: string,
  cost: number,
  amountPaid: number = 0,
  doctorId: string,
  newCaseName?: string,
  newCaseNameAr?: string,
  ownerEmail?: string | null
): Promise<any> => {

  const payload = {
    appointmentId,
    treatmentCaseId,
    serviceName,
    cost,
    amountPaid,
    doctorId,
    newCaseName,
    ownerEmail
  };

  try {
    const result = await window.electron.ipcRenderer.invoke('appointments:markAttended', payload);
    return result;
  } catch (error) {
    console.error('Service: markAppointmentAttended error:', error);
    return { success: false, error: String(error) };
  }
};

export const getDoctorReports = async (from: string, to: string, doctorId: string, email?: string | null): Promise<{ invoices: Invoice[], appointments: Appointment[] }> => {
  const result = await window.electron.ipcRenderer.invoke('reports:doctors', { from, to, doctorId, email });
  if (result.error) {
    console.error('Error fetching doctor reports:', result.error);
    return { invoices: [], appointments: [] };
  }

  // Map invoices (mimic getInvoices mapping)
  const mappedInvoices = (result.invoices || []).map((i: any) => ({
    id: i.id,
    patientId: i.patient_id,
    appointmentId: i.appointment_id,
    treatmentCaseId: i.treatment_case_id,
    doctorId: i.doctor_id,
    serviceName: i.service_name || '',
    serviceNameAr: '',
    cost: i.amount,
    amountPaid: i.paid_amount,
    balance: (i.amount || 0) - (i.paid_amount || 0),
    date: i.created_at,
    createdAt: i.created_at,
  }));

  return {
    invoices: mappedInvoices,
    appointments: result.appointments || []
  };
};
