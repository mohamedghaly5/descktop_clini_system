import React from 'react';
import { Calendar, Clock, User, CheckCircle } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/contexts/LanguageContext';
import { useSettings } from '@/contexts/SettingsContext';
import { cn } from '@/lib/utils';
import { Appointment, TreatmentCase } from '@/services/appointmentService';
import { Patient } from '@/services/patientService';

interface TodayAppointmentsTableProps {
  appointments: Appointment[];
  patientsMap: Map<string, Patient | null>;
  treatmentCasesMap: Map<string, TreatmentCase[]>;
  onMarkAttended: (appointment: Appointment) => void;
}

const TodayAppointmentsTable: React.FC<TodayAppointmentsTableProps> = ({
  appointments,
  patientsMap,
  treatmentCasesMap,
  onMarkAttended,
}) => {
  const { language } = useLanguage();
  const { getDoctorById } = useSettings();

  const statusConfig: Record<string, { label: string; className: string }> = {
    booked: {
      label: language === 'ar' ? 'محجوز' : 'Booked',
      className: 'bg-info/10 text-info border-info/20'
    },
    confirmed: {
      label: language === 'ar' ? 'مؤكد' : 'Confirmed',
      className: 'bg-primary/10 text-primary border-primary/20'
    },
    attended: {
      label: language === 'ar' ? 'حضر' : 'Attended',
      className: 'bg-success/10 text-success border-success/20'
    },
    cancelled: {
      label: language === 'ar' ? 'ملغي' : 'Cancelled',
      className: 'bg-destructive/10 text-destructive border-destructive/20'
    },
  };

  const getPatientName = (appointment: Appointment): string => {
    const patient = patientsMap.get(appointment.patientId);
    if (!patient) return language === 'ar' ? 'مريض محذوف' : 'Deleted Patient';
    return patient.name || appointment.patientName;
  };

  const getActiveTreatmentPlan = (patientId: string): string => {
    const cases = treatmentCasesMap.get(patientId) || [];
    const activeCase = cases.find(tc => tc.status === 'active');
    if (activeCase) {
      return activeCase.name;
    }
    return language === 'ar' ? 'لا يوجد' : 'None';
  };

  // Sort by time
  const sortedAppointments = [...appointments].sort((a, b) =>
    a.time.localeCompare(b.time)
  );

  return (
    <Card variant="elevated" className="animate-fade-in opacity-0 delay-200" style={{ animationDelay: '200ms' }}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-primary" />
          {language === 'ar' ? 'مواعيد اليوم' : "Today's Appointments"}
          <Badge variant="outline" className="ms-2 ltr-nums">{appointments.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {sortedAppointments.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>{language === 'ar' ? 'لا توجد مواعيد اليوم' : 'No appointments today'}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sortedAppointments.map((appointment, index) => (
              <div
                key={appointment.id}
                className="flex items-center gap-3 p-3 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors animate-fade-in opacity-0"
                style={{ animationDelay: `${(index + 3) * 50}ms` }}
              >
                {/* Time */}
                <div className="flex items-center gap-1 min-w-[70px]">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <span className="font-mono text-sm font-medium ltr-nums">{appointment.time}</span>
                </div>

                {/* Patient */}
                <div className="flex items-center gap-2 min-w-[140px]">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <User className="w-4 h-4 text-primary" />
                  </div>
                  <span className="text-sm font-medium truncate">
                    {getPatientName(appointment)}
                  </span>
                </div>

                {/* Service / Treatment Plan */}
                <div className="flex-1 min-w-[120px]">
                  <p className="text-sm text-foreground truncate">
                    {appointment.serviceName || appointment.service || (language === 'ar' ? 'زيارة عادية' : 'Regular Visit')}
                  </p>
                </div>

                {/* Status */}
                <Badge
                  variant="outline"
                  className={cn(statusConfig[appointment.status].className, "shrink-0 text-xs")}
                >
                  {statusConfig[appointment.status].label}
                </Badge>

                {/* Action Button */}
                {(appointment.status === 'booked' || appointment.status === 'confirmed') && (
                  <Button
                    variant="gradient"
                    size="sm"
                    onClick={() => onMarkAttended(appointment)}
                    className="shrink-0 gap-1"
                  >
                    <CheckCircle className="w-4 h-4" />
                    <span className="hidden sm:inline">
                      {language === 'ar' ? 'تسجيل الحضور' : 'Mark Attended'}
                    </span>
                  </Button>
                )}

                {appointment.status === 'attended' && (
                  <div className="flex items-center gap-1 text-success text-sm shrink-0">
                    <CheckCircle className="w-4 h-4" />
                    <span>{language === 'ar' ? 'تم' : 'Done'}</span>
                  </div>
                )}

                {appointment.status === 'cancelled' && (
                  <div className="text-destructive text-sm shrink-0">
                    {language === 'ar' ? 'ملغي' : 'Cancelled'}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TodayAppointmentsTable;
