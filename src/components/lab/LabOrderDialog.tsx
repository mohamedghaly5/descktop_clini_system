import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from 'sonner';
import { getLabServices, createLabOrder, LabService, getLabs, Lab } from '@/services/labService';

interface LabOrderDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSave: () => void;
}

const LabOrderDialog: React.FC<LabOrderDialogProps> = ({ open, onOpenChange, onSave }) => {
    const { t, isRTL } = useLanguage();
    const [loading, setLoading] = useState(false);

    // Dropdown Data
    const [labs, setLabs] = useState<Lab[]>([]);
    const [labServices, setLabServices] = useState<LabService[]>([]);
    const [patients, setPatients] = useState<any[]>([]);
    const [doctors, setDoctors] = useState<any[]>([]);

    const [formData, setFormData] = useState({
        lab_id: '',
        patient_id: '',
        doctor_id: '',
        lab_service_id: '',
        sent_date: new Date().toISOString().split('T')[0],
        expected_receive_date: '',
        total_lab_cost: 0,
        notes: ''
    });

    const [openPatientCombo, setOpenPatientCombo] = useState(false);

    useEffect(() => {
        if (open) {
            loadData();
        }
    }, [open]);

    const loadData = async () => {
        try {
            // Fetch Labs
            const fetchedLabs = await getLabs();
            setLabs(fetchedLabs || []);

            // Set default lab if exists and none selected
            if (fetchedLabs.length > 0 && !formData.lab_id) {
                const defaultLab = fetchedLabs.find(l => l.is_default) || fetchedLabs[0];
                setFormData(prev => ({ ...prev, lab_id: defaultLab.id }));
                const services = await getLabServices(defaultLab.id);
                setLabServices(services);
            } else if (formData.lab_id) {
                const services = await getLabServices(formData.lab_id);
                setLabServices(services);
            }

            // Fetch Patients
            // @ts-ignore
            const fetchedPatients = await window.electron.ipcRenderer.invoke('patients:getAll');
            setPatients(fetchedPatients || []);

            // Fetch Doctors
            // @ts-ignore
            const fetchedDoctors = await window.electron.ipcRenderer.invoke('doctors:getAll');
            setDoctors(fetchedDoctors || []);
        } catch (error) {
            console.error(error);
        }
    };

    const handleLabChange = async (labId: string) => {
        setFormData(prev => ({ ...prev, lab_id: labId, lab_service_id: '', total_lab_cost: 0 }));
        const services = await getLabServices(labId);
        setLabServices(services);
    };

    const handleServiceChange = (serviceId: string) => {
        const service = labServices.find(s => s.id === serviceId);
        setFormData(prev => ({
            ...prev,
            lab_service_id: serviceId,
            total_lab_cost: service?.default_cost || 0
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.lab_id || !formData.patient_id || !formData.doctor_id || !formData.lab_service_id || !formData.sent_date) {
            toast.error(t('requiredField') || 'Please fill in all required fields');
            return;
        }

        setLoading(true);
        try {
            const result = await createLabOrder(formData);
            if (result.success) {
                toast.success(t('savedSuccessfully') || 'Order created successfully');
                onSave();
                onOpenChange(false);
                // Reset form
                setFormData({
                    patient_id: '',
                    doctor_id: '',
                    lab_service_id: '',
                    sent_date: new Date().toISOString().split('T')[0],
                    expected_receive_date: '',
                    total_lab_cost: 0,
                    notes: ''
                });
            } else {
                toast.error(t('error') || 'Failed to create order');
            }
        } catch (error) {
            console.error(error);
            toast.error(t('error'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]" dir={isRTL ? 'rtl' : 'ltr'}>
                <DialogHeader className="text-start">
                    <DialogTitle>{t('lab.dialog.title')}</DialogTitle>
                    <DialogDescription>
                        {t('lab.dialog.description')}
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">

                    {/* Lab Select */}
                    <div className="grid gap-2">
                        <Label>Lab</Label>
                        <Select
                            value={formData.lab_id}
                            onValueChange={handleLabChange}
                        >
                            <SelectTrigger className={isRTL ? "text-right" : "text-left"}>
                                <SelectValue placeholder="Select Lab" />
                            </SelectTrigger>
                            <SelectContent>
                                {labs.map(lab => (
                                    <SelectItem key={lab.id} value={lab.id}>{lab.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Patient */}
                    {/* Patient - Searchable ComboBox */}
                    <div className="grid gap-2">
                        <Label>{t('lab.dialog.patient')}</Label>
                        <Popover open={openPatientCombo} onOpenChange={setOpenPatientCombo}>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="outline"
                                    role="combobox"
                                    aria-expanded={openPatientCombo}
                                    className={cn(
                                        "w-full justify-between font-normal",
                                        !formData.patient_id && "text-muted-foreground",
                                        isRTL ? "flex-row-reverse" : ""
                                    )}
                                >
                                    {formData.patient_id
                                        ? patients.find((p) => p.id === formData.patient_id)?.full_name
                                        : t('lab.dialog.selectPatient')}
                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                                <Command>
                                    <CommandInput placeholder={t('search') + "..."} className={isRTL ? "text-right" : "text-left"} />
                                    <CommandList>
                                        <CommandEmpty>{t('noResults')}</CommandEmpty>
                                        <CommandGroup>
                                            {patients.map((patient) => (
                                                <CommandItem
                                                    key={patient.id}
                                                    value={patient.full_name} // Search by name
                                                    onSelect={() => {
                                                        setFormData(prev => ({ ...prev, patient_id: patient.id }));
                                                        setOpenPatientCombo(false);
                                                    }}
                                                    className={isRTL ? "flex-row-reverse" : ""}
                                                >
                                                    <Check
                                                        className={cn(
                                                            "mr-2 h-4 w-4",
                                                            formData.patient_id === patient.id ? "opacity-100" : "opacity-0",
                                                            isRTL ? "ml-2 mr-0" : "mr-2 ml-0"
                                                        )}
                                                    />
                                                    {patient.full_name}
                                                </CommandItem>
                                            ))}
                                        </CommandGroup>
                                    </CommandList>
                                </Command>
                            </PopoverContent>
                        </Popover>
                    </div>

                    {/* Doctor */}
                    <div className="grid gap-2">
                        <Label>{t('lab.dialog.doctor')}</Label>
                        <Select
                            value={formData.doctor_id}
                            onValueChange={(val) => setFormData(prev => ({ ...prev, doctor_id: val }))}
                        >
                            <SelectTrigger className={isRTL ? "text-right" : "text-left"}>
                                <SelectValue placeholder={t('lab.dialog.selectDoctor')} />
                            </SelectTrigger>
                            <SelectContent>
                                {doctors.map(d => (
                                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Lab Service */}
                    <div className="grid gap-2">
                        <Label>{t('lab.dialog.service')}</Label>
                        <Select
                            value={formData.lab_service_id}
                            onValueChange={handleServiceChange}
                        >
                            <SelectTrigger className={isRTL ? "text-right" : "text-left"}>
                                <SelectValue placeholder={t('lab.dialog.selectService')} />
                            </SelectTrigger>
                            <SelectContent>
                                {labServices.length === 0 ? (
                                    <div className="p-2 text-sm text-muted-foreground text-center">No lab services defined</div>
                                ) : (
                                    labServices.map(s => (
                                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                    ))
                                )}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label>{t('lab.dialog.sentDate')}</Label>
                            <Input
                                type="date"
                                value={formData.sent_date}
                                onChange={(e) => setFormData(prev => ({ ...prev, sent_date: e.target.value }))}
                                required
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label>{t('lab.dialog.expectedDate')}</Label>
                            <Input
                                type="date"
                                value={formData.expected_receive_date}
                                onChange={(e) => setFormData(prev => ({ ...prev, expected_receive_date: e.target.value }))}
                            />
                        </div>
                    </div>

                    <div className="grid gap-2">
                        <Label>{t('lab.dialog.cost')}</Label>
                        <Input
                            type="number"
                            step="0.01"
                            value={formData.total_lab_cost}
                            onChange={(e) => setFormData(prev => ({ ...prev, total_lab_cost: parseFloat(e.target.value) }))}
                        />
                    </div>

                    <div className="grid gap-2">
                        <Label>{t('lab.dialog.notes')}</Label>
                        <Textarea
                            value={formData.notes}
                            onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                            rows={3}
                        />
                    </div>

                    <DialogFooter className="mt-4">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            {t('lab.dialog.cancel')}
                        </Button>
                        <Button type="submit" disabled={loading}>
                            {loading ? (t('lab.dialog.save') + '...') : t('lab.dialog.save')}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};

export default LabOrderDialog;
