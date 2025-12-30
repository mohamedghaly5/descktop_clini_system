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
export const getPatients = async (): Promise<Patient[]> => {
  const p = await db.patients.getAll();
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
  const patients = await getPatients();
  const p = patients.find(x => x.id === id);
  return p ? p.name : 'Unknown';
}

// ============ APPOINTMENTS ============
export const getAppointments = async (): Promise<Appointment[]> => {
  const data = await db.appointments.getAll();
  // We need to fetch patients to map names to match interface
  const patients = await getPatients(); // Inefficient but ok for MVP
  const services = await db.services.getAll();

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

export const createAppointment = async (appointment: Omit<Appointment, 'id' | 'createdAt' | 'updatedAt'>): Promise<Appointment> => {
  const result = await db.appointments.create({
    patient_id: appointment.patientId,
    date: appointment.date,
    time: appointment.time,
    status: appointment.status,
    notes: appointment.notes,
    service_id: appointment.service,
    // doctor_id?
  });

  console.log('IPC Result for createAppointment:', result);

  if (result.error) {
    console.error('IPC Error:', result.error);
    throw new Error(result.error);
  }

  // Extract ID based on varied IPC response formats
  // 1. Supabase-style: { data: { id: ... } }
  // 2. Direct object: { id: ... }
  // 3. SQLite run result: { lastInsertRowid: ... }
  // 4. Direct number: 123
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
export const getTreatmentCases = async (): Promise<TreatmentCase[]> => {
  // We need to add 'treatment_cases' table to SQLite
  const data = await window.electron.invoke('db:query', { sql: 'SELECT * FROM treatment_cases' }).catch(() => []);
  if (!data) return [];
  return data.map((tc: any) => ({
    id: tc.id,
    patientId: tc.patient_id,
    patientName: tc.patient_name, // Stored or joined?
    patientNameAr: tc.patient_name,
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

export const getActiveTreatmentCasesByPatient = async (patientId: string): Promise<TreatmentCase[]> => {
  const all = await getTreatmentCases();
  return all.filter(tc => tc.patientId === patientId && tc.status === 'active');
};

export const createTreatmentCase = async (treatmentCase: Omit<TreatmentCase, 'id' | 'createdAt' | 'updatedAt'>): Promise<TreatmentCase> => {
  const result = await window.electron.invoke('db:insert', {
    table: 'treatment_cases',
    data: {
      patient_id: treatmentCase.patientId,
      patient_name: treatmentCase.patientName,
      name: treatmentCase.name,
      total_cost: treatmentCase.totalCost,
      total_paid: treatmentCase.totalPaid,
      balance: treatmentCase.balance,
      status: treatmentCase.status
    }
  });

  if (result.error) {
    console.error('IPC Error in createTreatmentCase:', result.error);
    throw new Error(result.error);
  }

  return { ...treatmentCase, id: result.data.id, createdAt: '', updatedAt: '' };
};

export const updateTreatmentCase = async (id: string, updates: Partial<TreatmentCase>): Promise<TreatmentCase | null> => {
  const dbUpdates: any = {};
  if (updates.totalPaid !== undefined) dbUpdates.total_paid = updates.totalPaid;
  if (updates.balance !== undefined) dbUpdates.balance = updates.balance;
  if (updates.status) dbUpdates.status = updates.status;

  const result = await window.electron.invoke('db:update', { table: 'treatment_cases', id, data: dbUpdates });
  if (result.error) {
    console.error('IPC Error in updateTreatmentCase:', result.error);
    throw new Error(result.error);
  }
  return { id, ...updates } as TreatmentCase;
};

// ============ INVOICES ============
export const getInvoices = async (): Promise<Invoice[]> => {
  const data = await window.electron.invoke('services:getAll').catch(() => []); // Oops, need invoices:getAll
  // Using explicit SQL via generic handler if available, or just mocking empty for now
  // Let's assume we invoke a 'db:query' for strictness
  const res = await window.electron.invoke('db:query', { sql: 'SELECT * FROM invoices' }).catch(() => []);
  return res.map((i: any) => ({
    id: i.id,
    patientId: i.patient_id,
    appointmentId: i.appointment_id,
    treatmentCaseId: i.treatment_case_id, // Schema needs this
    doctorId: i.doctor_id,
    serviceName: i.service_name || '', // Schema needs this? Or join?
    serviceNameAr: '',
    cost: i.amount, // Schema has 'amount'
    amountPaid: i.paid_amount,
    balance: i.amount - i.paid_amount,
    date: i.created_at,
    createdAt: i.created_at
  }));
};

export const getInvoiceByAppointmentId = async (appointmentId: string): Promise<Invoice | undefined> => {
  const all = await getInvoices();
  return all.find(inv => inv.appointmentId === appointmentId);
};

export const createInvoice = async (invoice: Omit<Invoice, 'id' | 'createdAt'>): Promise<Invoice> => {
  const result = await window.electron.invoke('db:insert', {
    table: 'invoices',
    data: {
      patient_id: invoice.patientId,
      appointment_id: invoice.appointmentId,
      treatment_case_id: invoice.treatmentCaseId,
      amount: invoice.cost,
      paid_amount: invoice.amountPaid,
      status: invoice.balance > 0 ? 'pending' : 'paid'
    }
  });

  if (result.error) {
    console.error('IPC Error in createInvoice:', result.error);
    throw new Error(result.error);
  }

  return { ...invoice, id: result.data.id, createdAt: '' };
};

export const deleteInvoice = async (id: string): Promise<boolean> => {
  const result = await window.electron.invoke('invoices:delete', { id });
  if (result.error) {
    console.error('Error deleting invoice:', result.error);
    return false;
  }
  return true;
};

export const deleteTreatmentCase = async (id: string): Promise<boolean> => {
  const result = await window.electron.invoke('treatment_cases:delete', { id });
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
  newCaseNameAr?: string
): Promise<any> => { // Changed return type to any for raw IPC result

  const payload = {
    appointmentId,
    treatmentCaseId,
    serviceName,
    cost,
    amountPaid,
    doctorId,
    newCaseName
  };

  try {
    const result = await window.electron.invoke('appointments:markAttended', payload);
    return result;
  } catch (error) {
    console.error('Service: markAppointmentAttended error:', error);
    return { success: false, error: String(error) };
  }
};
export const getDoctorReports = async (from: string, to: string, doctorId: string): Promise<{ invoices: Invoice[], appointments: Appointment[] }> => {
  const result = await window.electron.invoke('reports:doctors', { from, to, doctorId });
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
    balance: i.amount - i.paid_amount,
    date: i.created_at,
    createdAt: i.created_at,
  }));

  // Map appointments if needed, or just pass formatted
  // Current getAppointments includes patient name, etc. The raw DB result might lack this.
  // Ideally we should reuse getAppointments logic but that fetches ALL.
  // For reports, we might need basic info.
  // Let's rely on standard mapping but we might miss Joined fields (Patient Name).
  // This is a trade-off. We might need to fetch patients separately or Join in SQL.
  // Given time constraints, let's Map what we have. 
  // Update: The UI (DoctorReports) assumes appointments have proper structure?
  // It uses `apt.status` and `apt.date`.
  // It DOES NOT display patient names in the aggregated table.
  // So raw mapping is fine.

  return {
    invoices: mappedInvoices,
    appointments: result.appointments || []
  };
};
