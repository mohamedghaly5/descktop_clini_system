import React, { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useSettings } from '@/contexts/SettingsContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit2, Trash2 } from 'lucide-react';
import { getAllLabServices, LabService, updateLabService, getLabs, Lab, getLabServices, deleteLab } from '@/services/labService';
import LabServiceDialog from './LabServiceDialog';
import AddLabDialog from './AddLabDialog';
import { toast } from 'sonner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const LabServicesSettings: React.FC = () => {
    const { t, language, isRTL } = useLanguage();
    const { hasPermission } = useAuth();
    const canEdit = hasPermission('CLINIC_SETTINGS');
    const { formatCurrency } = useSettings();
    const [labs, setLabs] = useState<Lab[]>([]);
    const [selectedLabId, setSelectedLabId] = useState<string>('');
    const [services, setServices] = useState<LabService[]>([]);
    const [loading, setLoading] = useState(true);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isAddLabOpen, setIsAddLabOpen] = useState(false);
    const [selectedService, setSelectedService] = useState<LabService | null>(null);

    const fetchLabs = async () => {
        const data = await getLabs();
        setLabs(data);
        if (data.length > 0 && !selectedLabId) {
            // Select default lab or first one
            const defaultLab = data.find(l => l.is_default) || data[0];
            setSelectedLabId(defaultLab.id);
        }
    };

    const fetchServices = async () => {
        if (!selectedLabId) return;
        setLoading(true);
        try {
            const data = await getLabServices(selectedLabId);
            setServices(data);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLabs();
    }, []);

    useEffect(() => {
        if (selectedLabId) {
            fetchServices();
        }
    }, [selectedLabId]);

    const handleEdit = (service: LabService) => {
        setSelectedService(service);
        setIsDialogOpen(true);
    };

    const handleAdd = () => {
        setSelectedService(null);
        setIsDialogOpen(true);
    };

    const handleDeleteLab = async () => {
        if (!selectedLabId) return;
        if (!confirm('Are you sure you want to delete this lab?')) return;

        try {
            const result = await deleteLab(selectedLabId);
            if (result.success) {
                toast.success('Lab deleted successfully');
                setSelectedLabId('');
                fetchLabs();
            } else {
                toast.error(result.error);
            }
        } catch (error) {
            console.error(error);
            toast.error(t('error'));
        }
    };

    const toggleStatus = async (service: LabService) => {
        const newStatus = service.is_active === 1 ? 0 : 1;
        try {
            const result = await updateLabService({
                ...service,
                is_active: newStatus
            });
            if (result.success) {
                toast.success(t('success'));
                fetchServices();
            } else {
                toast.error(t('error'));
            }
        } catch (error) {
            console.error(error);
            toast.error(t('error'));
        }
    };

    // If we haven't loaded labs yet, show loading or empty
    if (labs.length === 0 && !loading) return null; // Or a spinner


    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h3 className="text-lg font-medium">{t('settings.labServices.title')}</h3>
                    <p className="text-sm text-muted-foreground">
                        {t('settings.labServices.description')}
                    </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto items-center">
                    <div className="flex items-center gap-2">
                        <Select value={selectedLabId} onValueChange={setSelectedLabId}>
                            <SelectTrigger className="w-[200px]">
                                <SelectValue placeholder="Select Lab" />
                            </SelectTrigger>
                            <SelectContent>
                                {labs.map(lab => (
                                    <SelectItem key={lab.id} value={lab.id}>{lab.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        {selectedLabId && (
                            <Button variant="ghost" size="icon" className="text-destructive" onClick={handleDeleteLab} title="Delete Lab" disabled={!canEdit}>
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        )}
                    </div>

                    <Button onClick={() => setIsAddLabOpen(true)} variant="outline" className="gap-2 shrink-0" disabled={!canEdit}>
                        <Plus className="h-4 w-4" />
                        Add Lab
                    </Button>

                    <Button onClick={handleAdd} className="gap-2 shrink-0" disabled={!canEdit}>
                        <Plus className="h-4 w-4" />
                        {t('settings.labServices.add')}
                    </Button>
                </div>
            </div>

            <Card>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="text-start">{t('settings.labServices.name')}</TableHead>
                                <TableHead className="text-start">{t('settings.labServices.cost')}</TableHead>
                                <TableHead className="text-center">{t('settings.labServices.status')}</TableHead>
                                <TableHead className="text-end">{t('expenses.table.actions')}</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {services.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                                        {t('noResults')}
                                    </TableCell>
                                </TableRow>
                            ) : (
                                services.map((service) => (
                                    <TableRow key={service.id}>
                                        <TableCell className="font-medium">{service.name}</TableCell>
                                        <TableCell className="ltr-nums">{formatCurrency(service.default_cost, language)}</TableCell>
                                        <TableCell className="text-center">
                                            <Badge
                                                variant={service.is_active ? 'default' : 'secondary'}
                                                className={`cursor-pointer ${!canEdit ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                onClick={() => canEdit && toggleStatus(service)}
                                            >
                                                {service.is_active ? t('settings.labServices.active') : t('settings.labServices.inactive')}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-end">
                                            <Button variant="ghost" size="sm" onClick={() => handleEdit(service)} disabled={!canEdit}>
                                                <Edit2 className="h-4 w-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <LabServiceDialog
                open={isDialogOpen}
                onOpenChange={setIsDialogOpen}
                serviceToEdit={selectedService}
                onSuccess={fetchServices}
                labId={selectedLabId}
            />

            <AddLabDialog
                open={isAddLabOpen}
                onOpenChange={setIsAddLabOpen}
                onSuccess={fetchLabs}
            />
        </div>
    );
};

export default LabServicesSettings;
