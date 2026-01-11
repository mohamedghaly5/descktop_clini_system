import React, { useState } from 'react';
import { FileText, Calendar, TrendingUp, Download, Users, Eye } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import DoctorReports from '@/components/reports/DoctorReports';
import DailyReportDialog from '@/components/reports/DailyReportDialog';
import { toast } from 'sonner';

const ReportsPage: React.FC = () => {
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [dailyReportOpen, setDailyReportOpen] = useState(false);

  const handleReportClick = (reportId: string) => {
    switch (reportId) {
      case 'daily':
        setDailyReportOpen(true);
        break;
      case 'monthly':
        toast.info('التقرير الشهري قيد التطوير', {
          description: 'سيتم إضافة هذه الميزة قريباً',
        });
        break;
      case 'yearly':
        toast.info('التقرير السنوي قيد التطوير', {
          description: 'سيتم إضافة هذه الميزة قريباً',
        });
        break;
      default:
        break;
    }
  };

  const reports = [
    {
      id: 'daily',
      titleAr: 'التقرير اليومي',
      descAr: 'الدخل اليومي، المواعيد المحضورة والملغاة',
      icon: Calendar,
      color: 'primary',
      available: true,
    },
    {
      id: 'monthly',
      titleAr: 'التقرير الشهري',
      descAr: 'إجمالي الدخل، الزيارات، وأفضل الخدمات',
      icon: TrendingUp,
      color: 'accent',
      available: false,
    },
    {
      id: 'yearly',
      titleAr: 'الأداء السنوي',
      descAr: 'الاتجاهات والمقارنات السنوية',
      icon: FileText,
      color: 'success',
      available: false,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-start">
        <h1 className="text-2xl font-bold text-foreground">{t('reports')}</h1>
        <p className="text-muted-foreground">عرض وتصدير تقارير العيادة</p>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger value="overview" className="gap-2">
            <FileText className="w-4 h-4" />
            نظرة عامة
          </TabsTrigger>
          <TabsTrigger value="doctors" className="gap-2">
            <Users className="w-4 h-4" />
            حسب الطبيب
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          {/* Reports Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {reports.map((report, index) => (
              <Card
                key={report.id}
                variant="elevated"
                className={cn(
                  "animate-fade-in opacity-0 hover:shadow-xl transition-all cursor-pointer group",
                  !report.available && "opacity-70"
                )}
                style={{ animationDelay: `${index * 100}ms` }}
                onClick={() => handleReportClick(report.id)}
              >
                <CardHeader>
                  <div className={cn(
                    "w-14 h-14 rounded-xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110",
                    report.color === 'primary' && "gradient-primary",
                    report.color === 'accent' && "gradient-accent",
                    report.color === 'success' && "gradient-success",
                  )}>
                    <report.icon className="w-7 h-7 text-primary-foreground" />
                  </div>
                  <CardTitle className="text-start">
                    {report.titleAr}
                  </CardTitle>
                  <CardDescription className="text-start">
                    {report.descAr}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button
                    variant={report.available ? "default" : "outline"}
                    className={cn(
                      "w-full transition-colors",
                      report.available && "group-hover:bg-primary"
                    )}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleReportClick(report.id);
                    }}
                  >
                    {report.available ? (
                      <>
                        <Eye className="w-4 h-4" />
                        عرض التقرير
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4" />
                        قريباً
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Coming Soon */}
          <Card variant="ghost" className="border-2 border-dashed border-border mt-6">
            <CardContent className="py-12 text-center">
              <FileText className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-semibold text-muted-foreground mb-2">
                تقارير إضافية قريباً
              </h3>
              <p className="text-sm text-muted-foreground">
                سيتم إضافة تقارير متقدمة وتحليلات في التحديثات القادمة
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="doctors">
          <DoctorReports email={user?.email} />
        </TabsContent>
      </Tabs>

      {/* Daily Report Dialog */}
      <DailyReportDialog
        open={dailyReportOpen}
        onOpenChange={setDailyReportOpen}
        email={user?.email}
      />
    </div>
  );
};

export default ReportsPage;
