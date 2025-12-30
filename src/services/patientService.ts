import { db } from './db';

const PATIENTS_KEY = 'dentacare_patients'; // Keeping for reference or fallback

export interface Patient {
  id: string;
  name: string;
  phone: string;
  gender: 'male' | 'female';
  age: number;
  cityId: string;
  notes: string;
  deleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PatientAttachment {
  id: string;
  patientId: string;
  fileName: string;
  fileUrl: string;
  fileType: 'xray' | 'image' | 'document' | 'other';
  notes: string;
  uploadDate: string;
}

// ============ PATIENTS CRUD ============
export const getPatients = async (): Promise<Patient[]> => {
  try {
    const data = await db.patients.getAll();
    return data.map((p: any) => ({
      id: p.id,
      name: p.full_name,
      phone: p.phone,
      gender: p.gender,
      age: p.age,
      cityId: p.city_id,
      notes: p.notes,
      deleted: false,
      createdAt: p.created_at,
      updatedAt: p.updated_at
    }));
  } catch (error) {
    console.error("Failed to get patients", error);
    return [];
  }
};

export const getActivePatients = async (): Promise<Patient[]> => {
  const all = await getPatients();
  return all;
};

export const getPatientById = async (id: string): Promise<Patient | undefined> => {
  const all = await getPatients(); // Inefficient, use specific query in future
  return all.find(p => p.id === id);
};

export const checkDuplicatePatient = async (phone: string, excludeId?: string): Promise<boolean> => {
  const patients = await getActivePatients();
  const normalizedPhone = phone.replace(/\s/g, '');
  return patients.some(p =>
    p.phone.replace(/\s/g, '') === normalizedPhone && p.id !== excludeId
  );
};

export const createPatient = async (patient: Omit<Patient, 'id' | 'deleted' | 'createdAt' | 'updatedAt'> & { clinicId?: string }): Promise<{ success: boolean; data?: Patient; error?: string; code?: 'DUPLICATE_PHONE' | 'DB_ERROR' }> => {
  if (await checkDuplicatePatient(patient.phone)) {
    return { success: false, error: 'Patient with this phone number already exists', code: 'DUPLICATE_PHONE' };
  }

  const result = await db.patients.create({
    full_name: patient.name,
    phone: patient.phone,
    gender: patient.gender,
    age: patient.age,
    city_id: patient.cityId,
    notes: patient.notes,
    clinic_id: patient.clinicId || 'default'
  });

  if (result.error) {
    console.error(result.error);
    return { success: false, error: result.error, code: 'DB_ERROR' };
  }

  return {
    success: true,
    data: {
      ...patient,
      id: result.data.id,
      deleted: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  };
};

export const updatePatient = async (id: string, updates: Partial<Patient>): Promise<Patient | null> => {
  if (updates.phone && await checkDuplicatePatient(updates.phone, id)) {
    return null;
  }

  const dbUpdates: any = {};
  if (updates.name) dbUpdates.full_name = updates.name;
  if (updates.phone) dbUpdates.phone = updates.phone;
  if (updates.gender) dbUpdates.gender = updates.gender;
  if (updates.age) dbUpdates.age = updates.age;
  if (updates.cityId) dbUpdates.city_id = updates.cityId;
  if (updates.notes) dbUpdates.notes = updates.notes;

  const result = await db.patients.update(id, dbUpdates);
  if (result.error) {
    console.error(result.error);
    return null;
  }
  return {
    id,
    name: updates.name || '',
    phone: updates.phone || '',
    cityId: updates.cityId || '',
    gender: updates.gender || 'male',
    age: updates.age || 0,
    notes: updates.notes || '',
    deleted: false,
    createdAt: '',
    updatedAt: '',
    ...updates
  } as Patient;
};

export const softDeletePatient = async (id: string): Promise<boolean> => {
  await db.patients.delete(id);
  return true;
};

export const restorePatient = async (id: string): Promise<boolean> => {
  return false;
};

// ============ ATTACHMENTS CRUD ============
export const getAttachmentsByPatientId = async (patientId: string): Promise<PatientAttachment[]> => {
  const data = await window.electron.invoke('db:query', {
    sql: 'SELECT * FROM attachments WHERE patient_id = ?',
    params: [patientId]
  });
  return data.map((a: any) => ({
    id: a.id,
    patientId: a.patient_id,
    fileName: a.file_name,
    fileUrl: a.file_url, // Base64 string for now
    fileType: a.file_type,
    notes: a.notes,
    uploadDate: a.created_at
  }));
};

export const createAttachment = async (attachment: Omit<PatientAttachment, 'id'>): Promise<PatientAttachment> => {
  const result = await window.electron.invoke('db:insert', {
    table: 'attachments',
    data: {
      patient_id: attachment.patientId,
      file_name: attachment.fileName,
      file_url: attachment.fileUrl,
      file_type: attachment.fileType,
      notes: attachment.notes
    }
  });
  return { ...attachment, id: result.data.id };
};

export const deleteAttachment = async (id: string): Promise<boolean> => {
  await window.electron.invoke('db:delete', { table: 'attachments', id });
  return true;
};

// ============ STATS ============
export const getPatientStats = async (patientId: string) => {
  // We can use SQL queries for this aggregation

  // Total Appointments
  const appointmentsRes = await window.electron.invoke('db:query', {
    sql: 'SELECT * FROM appointments WHERE patient_id = ?',
    params: [patientId]
  });

  // Invoices for paid/balance
  const invoicesRes = await window.electron.invoke('db:query', {
    sql: 'SELECT * FROM invoices WHERE patient_id = ?',
    params: [patientId]
  });

  const treatmentCasesRes = await window.electron.invoke('db:query', {
    sql: 'SELECT * FROM treatment_cases WHERE patient_id = ?',
    params: [patientId]
  });

  const services = await db.services.getAll();

  const totalAppointments = appointmentsRes.length;
  const attendedAppointments = appointmentsRes.filter((a: any) => a.status === 'attended').length;

  const totalPaid = invoicesRes.reduce((sum: number, inv: any) => sum + (inv.paid_amount || 0), 0);
  // const totalCost = invoicesRes.reduce((sum: number, inv: any) => sum + (inv.amount || 0), 0); 
  const totalBalance = treatmentCasesRes.reduce((sum: number, tc: any) => sum + (tc.balance || 0), 0);

  return {
    totalAppointments,
    attendedAppointments,
    totalPaid,
    totalBalance,
    appointments: appointmentsRes.map((a: any) => {
      const s = services.find((srv: any) => srv.id === a.service_id);
      return {
        id: a.id,
        date: a.date,
        time: a.time,
        service: s ? s.name : 'Unknown', // Map ID to name
        serviceAr: s ? s.name : 'Unknown', // Ideally name_ar if available
        status: a.status
      };
    }),
    invoices: invoicesRes.map((i: any) => {
      // Invoices usually store service name snapshot or link to service?
      // Schema: service_id.
      const s = services.find((srv: any) => srv.id === i.service_id);
      return {
        id: i.id,
        date: i.created_at,
        serviceName: s ? s.name : 'Unknown',
        serviceNameAr: s ? s.name : 'Unknown',
        amountPaid: i.paid_amount,
        balance: (i.amount - i.paid_amount)
      };
    }),
    treatmentCases: treatmentCasesRes.map((tc: any) => ({
      id: tc.id,
      name: tc.name,
      nameAr: tc.name, // If we had ar name
      totalCost: tc.total_cost,
      totalPaid: tc.total_paid,
      balance: tc.balance,
      status: tc.status
    }))
  };
};
