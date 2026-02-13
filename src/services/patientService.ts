import { db } from './db';

const PATIENTS_KEY = 'dentacare_patients'; // Keeping for reference or fallback

export interface Patient {
  id: string;
  name: string;
  phone: string;
  gender: 'male' | 'female';
  age?: number;
  birthDate?: string;
  cityId: string;
  notes: string;
  medicalHistory?: string;
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
export const getPatients = async (email?: string | null): Promise<Patient[]> => {
  try {
    const data = await db.patients.getAll(email);
    return data.map((p: any) => {
      // Calculate age if birth_date exists and age is missing
      let calculatedAge = p.age;
      if (!calculatedAge && p.birth_date) {
        const birthDate = new Date(p.birth_date);
        const today = new Date();
        calculatedAge = today.getFullYear() - birthDate.getFullYear();
        const m = today.getMonth() - birthDate.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
          calculatedAge--;
        }
      }

      return {
        id: p.id,
        name: p.full_name,
        phone: p.phone,
        gender: p.gender,
        age: calculatedAge,
        birthDate: p.birth_date,
        cityId: p.city_id,
        notes: p.notes,
        medicalHistory: p.medical_history,
        deleted: false,
        createdAt: p.created_at,
        updatedAt: p.updated_at
      };
    });
  } catch (error) {
    console.error("Failed to get patients", error);
    return [];
  }
};


export const getActivePatients = async (email?: string | null): Promise<Patient[]> => {
  const all = await getPatients(email);
  return all;
};

export const getPatientById = async (id: string): Promise<Patient | undefined> => {
  try {
    // Use dedicated endpoint that returns patient even if soft-deleted
    const patient = await db.patients.getById(id);
    if (!patient) return undefined;
    return {
      id: patient.id,
      name: patient.full_name || patient.name,
      phone: patient.phone,
      gender: patient.gender,
      age: patient.age,
      birthDate: patient.birth_date,
      cityId: patient.city_id || '',
      notes: patient.notes || '',
      medicalHistory: patient.medical_history,
      deleted: !!patient.is_deleted,
      createdAt: patient.created_at,
      updatedAt: patient.updated_at,
    };
  } catch (error) {
    console.error("Failed to get patient", error);
    return undefined;
  }
};

export const checkDuplicatePatient = async (phone: string, excludeId?: string): Promise<boolean> => {
  const patients = await getActivePatients();
  const normalizedPhone = phone.replace(/\s/g, '');
  return patients.some(p =>
    p.phone.replace(/\s/g, '') === normalizedPhone && p.id !== excludeId
  );
};

export const createPatient = async (patient: Omit<Patient, 'id' | 'deleted' | 'createdAt' | 'updatedAt'> & { clinicId?: string, ownerEmail?: string }): Promise<{ success: boolean; data?: Patient; error?: string; code?: 'DUPLICATE_PHONE' | 'DB_ERROR' }> => {
  if (await checkDuplicatePatient(patient.phone)) {
    return { success: false, error: 'Patient with this phone number already exists', code: 'DUPLICATE_PHONE' };
  }

  const result = await db.patients.create({
    full_name: patient.name,
    phone: patient.phone,
    gender: patient.gender,
    birth_date: patient.birthDate,
    city_id: patient.cityId,
    notes: patient.notes,
    medical_history: patient.medicalHistory
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
  if (updates.birthDate) dbUpdates.birth_date = updates.birthDate;
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

export interface DeletePatientOptions {
  deleteAppointments?: boolean;
  deleteTreatmentCases?: boolean;
  deleteInvoices?: boolean;
}

export const deletePatient = async (id: string, options?: DeletePatientOptions): Promise<boolean> => {
  try {
    await db.patients.delete(id, options);
    return true;
  } catch (error) {
    console.error('Failed to delete patient:', error);
    return false;
  }
};

// Legacy alias for backward compatibility
export const softDeletePatient = deletePatient;

export const restorePatient = async (id: string): Promise<boolean> => {
  return false;
};

// ============ ATTACHMENTS CRUD ============
export const getAttachmentsByPatientId = async (patientId: string): Promise<PatientAttachment[]> => {
  // Use db.query to support both Local and Remote
  const data = await db.query('SELECT * FROM attachments WHERE patient_id = ?', [patientId]);

  if (!Array.isArray(data)) return [];

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
  console.log('[createAttachment] Validating Patient ID:', attachment.patientId);

  // Validate UUID to ensure DB integrity
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(attachment.patientId)) {
    throw new Error(`Invalid Patient ID: ${attachment.patientId}. Expected UUID.`);
  }

  const result = await db.from('attachments').insert({
    patient_id: attachment.patientId,
    file_name: attachment.fileName,
    file_url: attachment.fileUrl,
    file_type: attachment.fileType,
    notes: attachment.notes
  });

  if (result.error) {
    throw new Error(result.error);
  }

  const newId = result.data?.id || result.data?.lastInsertRowid; // Check both

  return { ...attachment, id: newId };
};

export const deleteAttachment = async (id: string): Promise<boolean> => {
  await db.from('attachments').delete().eq('id', id);
  return true;
};

// ============ STATS ============
export const getPatientStats = async (patientId: string, email?: string | null) => {
  // We can use SQL queries for this aggregation

  const appSql = 'SELECT * FROM appointments WHERE patient_id = ?';
  const appParams = [patientId];
  const appointmentsRes = await db.query(appSql, appParams);

  // Invoices for paid/balance
  const invSql = 'SELECT * FROM invoices WHERE patient_id = ?';
  const invParams = [patientId];
  const invoicesRes = await db.query(invSql, invParams);

  // Treatment Cases
  const tcSql = 'SELECT * FROM treatment_cases WHERE patient_id = ?';
  const tcParams = [patientId];
  const treatmentCasesRes = await db.query(tcSql, tcParams);

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
