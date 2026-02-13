import axios from 'axios';
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
// ============ PATIENTS (Proxy) ============
export const getPatients = async (email?: string | null): Promise<Patient[]> => {
  try {
    const p = await db.patients.getAll(email);
    if (Array.isArray(p)) {
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
    }
    return [];
  } catch (e) {
    console.error('getPatients error', e);
    return [];
  }
};


// ============ APPOINTMENTS ============
export const getAppointments = async (email?: string | null): Promise<Appointment[]> => {
  const data = await db.appointments.getAll(email);
  const patients = await getPatients(email);
  const services = await db.services.getAll(email);

  return data.map((a: any) => {
    const p = patients.find(x => x.id === a.patient_id);
    const s = services.find((x: any) => x.id === a.service_id);
    return {
      id: a.id,
      patientId: a.patient_id,
      patientName: p ? p.name : 'Unknown',
      patientNameAr: p ? p.name : 'Unknown',
      doctorId: a.doctor_id,
      doctorName: a.doctor_name,
      doctorNameAr: a.doctor_name_ar,
      date: a.date,
      time: a.time,
      service: a.service_id,
      serviceName: a.service_name,
      serviceAr: s ? s.name : '',
      status: a.status as any,
      notes: a.notes,
      treatmentCaseId: a.treatment_case_id,
      invoiceId: a.invoice_id,
      createdAt: a.created_at,
      updatedAt: a.updated_at
    };
  });
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

  const result = await db.appointments.create(payload);

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
  // Use db service
  const data = await db.treatmentCases.getAll(email);
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
  // Use db service
  const data = await db.treatmentCases.getByPatient(patientId);

  if (!Array.isArray(data)) return [];

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
  const result = await db.treatmentCases.create({ ...treatmentCase, ownerEmail: email });

  if (result?.error) {
    throw new Error(result.error);
  }

  // Handle case where result is just ID (API style) or object (IPC style)
  let id = result?.data?.id || result?.id || (typeof result === 'string' || typeof result === 'number' ? result : '');

  if (!id && result?.lastInsertRowid) id = result.lastInsertRowid;

  return { ...treatmentCase, id: String(id), createdAt: '', updatedAt: '' };
};

export const updateTreatmentCase = async (id: string, updates: Partial<TreatmentCase>): Promise<TreatmentCase | null> => {
  const dbUpdates: any = {};
  if (updates.totalPaid !== undefined) dbUpdates.total_paid = updates.totalPaid;
  if (updates.balance !== undefined) dbUpdates.balance = updates.balance;
  if (updates.status) dbUpdates.status = updates.status;

  const result = await db.treatmentCases.update(id, dbUpdates);
  if (result.error) {
    console.error('Update TC Error:', result.error);
    throw new Error(result.error);
  }
  return { id, ...updates } as TreatmentCase;
};

// ============ INVOICES ============
export const getInvoices = async (email?: string | null): Promise<Invoice[]> => {
  const data = await db.invoices.getAll(email);
  if (!Array.isArray(data)) return [];

  return data.map((i: any) => ({
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
  const payload = {
    patient_id: invoice.patientId,
    appointment_id: invoice.appointmentId,
    treatment_case_id: invoice.treatmentCaseId,
    amount: invoice.cost,
    paid_amount: invoice.amountPaid || 0,
    status: invoice.balance > 0 ? 'pending' : 'paid',
    doctor_id: invoice.doctorId,
    service_id: invoice.serviceName // Warning: This field in Invoice interface is 'serviceName'. Just mapping it for now.
  };

  const result = await db.invoices.create(payload);

  if (result.error) {
    console.error('Create Invoice Error:', result.error);
    throw new Error(result.error);
  }

  let id = result?.data?.id || result?.id || result?.lastInsertRowid;

  return { ...invoice, id: String(id), createdAt: '' };
};

export const deleteInvoice = async (id: string): Promise<boolean> => {
  const result = await db.invoices.delete(id);
  if (result && result.error) {
    console.error('Error deleting invoice:', result.error);
    return false;
  }
  return true;
};

export const deleteTreatmentCase = async (id: string): Promise<boolean> => {
  const result = await db.treatmentCases.delete(id);
  if (result && result.error) {
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
    const result = await db.appointments.markAttended(payload);
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
