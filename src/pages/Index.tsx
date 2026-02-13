import React, { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useSettings } from '@/contexts/SettingsContext';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import {
  getAppointments,
  getInvoices,
  getTreatmentCases,
  Appointment,
  Invoice,
  TreatmentCase
} from '@/services/appointmentService';
import { getActivePatients, Patient } from '@/services/patientService';
import DashboardKPICards from '@/components/dashboard/DashboardKPICards';
import { useExpenses } from '@/hooks/useExpenses';
import TodayAppointmentsTable from '@/components/dashboard/TodayAppointmentsTable';
import DashboardAlerts from '@/components/dashboard/DashboardAlerts';
import DashboardQuickActions from '@/components/dashboard/DashboardQuickActions';
import { MarkAttendedDialog } from '@/components/appointments/MarkAttendedDialog';
import { BookAppointmentDialog } from '@/components/appointments/BookAppointmentDialog';

import DailyReportDialog from '@/components/reports/DailyReportDialog';

const Dashboard: React.FC = () => {
  const { t, isRTL, language } = useLanguage();
  const { clinicInfo } = useSettings();
  const { user } = useAuth();

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  // ... (keep state)
  const [treatmentCases, setTreatmentCases] = useState<TreatmentCase[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const { expenses, refresh: refreshExpenses } = useExpenses();

  const [patientsMap, setPatientsMap] = useState<Map<string, Patient | null>>(new Map());
  const [treatmentCasesMap, setTreatmentCasesMap] = useState<Map<string, TreatmentCase[]>>(new Map());

  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [attendedDialogOpen, setAttendedDialogOpen] = useState(false);
  const [bookDialogOpen, setBookDialogOpen] = useState(false);
  const [dailyReportOpen, setDailyReportOpen] = useState(false);

  const loadData = async () => {
    // ... (keep loadData logic)
    if (!user?.email) return;
    try {
      const [
        loadedAppointments,
        loadedInvoices,
        loadedTreatmentCases,
        loadedPatients
      ] = await Promise.all([
        getAppointments(user.email),
        getInvoices(user.email),
        getTreatmentCases(user.email),
        getActivePatients(user.email)
      ]);

      setAppointments(loadedAppointments);
      setInvoices(loadedInvoices);
      setTreatmentCases(loadedTreatmentCases);
      setPatients(loadedPatients);

      refreshExpenses();

      const pMap = new Map<string, Patient | null>();
      loadedPatients.forEach(p => pMap.set(p.id, p));
      setPatientsMap(pMap);

      const tcMap = new Map<string, TreatmentCase[]>();
      loadedTreatmentCases.forEach(tc => {
        const existing = tcMap.get(tc.patientId) || [];
        existing.push(tc);
        tcMap.set(tc.patientId, existing);
      });
      setTreatmentCasesMap(tcMap);
    } catch (e) {
      console.error("Failed to load dashboard data", e);
    }
  };

  useEffect(() => {
    loadData();
    const handleStorage = () => loadData();
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const today = new Date().toISOString().split('T')[0];
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const todayAppointments = appointments.filter(a => a.date === today);
  const todayInvoices = invoices.filter(inv => {
    const invDate = new Date(inv.date);
    invDate.setHours(0, 0, 0, 0);
    return invDate.getTime() === todayStart.getTime();
  });

  const pastUnattendedAppointments = appointments.filter(a =>
    a.date < today && (a.status === 'booked' || a.status === 'confirmed')
  );

  const patientBalances = new Map<string, { patientId: string; patientName: string; balance: number }>();

  treatmentCases.forEach(tc => {
    const remaining = tc.totalCost - tc.totalPaid;
    if (tc.status === 'active' && remaining > 1.0) {
      const existing = patientBalances.get(tc.patientId);
      const patient = patientsMap.get(tc.patientId);
      const patientName = patient?.name || (language === 'ar' ? 'مريض' : 'Patient');

      if (existing) {
        existing.balance += remaining;
      } else {
        patientBalances.set(tc.patientId, {
          patientId: tc.patientId,
          patientName,
          balance: remaining,
        });
      }
    }
  });

  const patientsWithBalance = Array.from(patientBalances.values());
  const outstandingInvoices = invoices.filter(inv => inv.balance > 0);

  const handleMarkAttended = (appointment: Appointment) => {
    setSelectedAppointment(appointment);
    setAttendedDialogOpen(true);
  };

  const handleAttendedSuccess = () => {
    loadData();
  };

  const handleNewAppointment = () => {
    setBookDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1 text-start">
        <h1 className="text-2xl font-bold text-foreground">
          {t('welcomeBack')}, {language === 'ar' ? 'دكتور' : 'Doctor'}{clinicInfo.ownerName ? ` ${clinicInfo.ownerName}` : ''}
        </h1>
        <p className="text-muted-foreground">
          {clinicInfo.name} - {new Date().toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US', {
            calendar: 'gregory',
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          })}
        </p>
      </div>

      <DashboardKPICards
        todayAppointments={todayAppointments}
        todayInvoices={todayInvoices}
        allInvoices={invoices}
        expenses={expenses}
      />

      <TodayAppointmentsTable
        appointments={todayAppointments}
        patientsMap={patientsMap}
        treatmentCasesMap={treatmentCasesMap}
        onMarkAttended={handleMarkAttended}
      />

      <DashboardQuickActions
        onNewAppointment={handleNewAppointment}
        onOpenDailyReport={() => setDailyReportOpen(true)}
      />

      <DashboardAlerts
        pastUnattendedAppointments={pastUnattendedAppointments}
        outstandingInvoices={outstandingInvoices}
        patientsWithBalance={patientsWithBalance}
      />

      <MarkAttendedDialog
        open={attendedDialogOpen}
        onOpenChange={setAttendedDialogOpen}
        appointment={selectedAppointment}
        onSuccess={handleAttendedSuccess}
      />

      <BookAppointmentDialog
        open={bookDialogOpen}
        onOpenChange={setBookDialogOpen}
        onSuccess={loadData}
      />

      <DailyReportDialog
        open={dailyReportOpen}
        onOpenChange={setDailyReportOpen}
        email={user?.email}
      />
    </div>
  );
};

export default Dashboard;
