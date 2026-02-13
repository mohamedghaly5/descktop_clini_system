import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/services/db';
import { settingsService } from '@/services/settingsService';

export interface Service {
  id: string;
  name: string;
  defaultPrice: number;
}

export interface City {
  id: string;
  name: string;
}

export interface Doctor {
  id: string;
  name: string;
  role: 'doctor' | 'assistant' | 'hygienist';
  active: boolean;
  commissionType?: 'percentage' | 'fixed';
  commissionValue?: number;
}

export interface ClinicInfo {
  id?: string;
  name: string;
  ownerName: string;
  address: string;
  phone: string;
  whatsappNumber: string;
  email: string;
  logo: string;
}

export type CurrencyCode = 'EGP' | 'SAR' | 'USD' | 'AED' | 'KWD';

export interface CurrencyOption {
  code: CurrencyCode;
  symbol: string;
  displayName: string;
}

export const CURRENCY_OPTIONS: CurrencyOption[] = [
  { code: 'EGP', symbol: 'ج.م', displayName: 'جنيه مصري (EGP)' },
  { code: 'SAR', symbol: 'ر.س', displayName: 'ريال سعودي (SAR)' },
  { code: 'USD', symbol: '$', displayName: 'دولار أمريكي (USD)' },
  { code: 'AED', symbol: 'د.إ', displayName: 'درهم إماراتي (AED)' },
  { code: 'KWD', symbol: 'د.ك', displayName: 'دينار كويتي (KWD)' },
];

const DEFAULT_CLINIC_INFO: ClinicInfo = {
  name: 'عيادتي',
  ownerName: '',
  address: '',
  phone: '',
  whatsappNumber: '',
  email: '',
  logo: '',
};

interface SettingsContextType {
  // Loading state
  loading: boolean;

  // Services
  services: Service[];
  addService: (service: Omit<Service, 'id'>) => Promise<boolean>;
  updateService: (id: string, service: Partial<Service>) => Promise<boolean>;
  deleteService: (id: string) => Promise<void>;
  getServiceById: (id: string) => Service | undefined;

  // Cities
  cities: City[];
  addCity: (city: Omit<City, 'id'>) => Promise<boolean>;
  updateCity: (id: string, city: Partial<City>) => Promise<boolean>;
  deleteCity: (id: string) => Promise<void>;

  // Doctors
  doctors: Doctor[];
  activeDoctors: Doctor[];
  addDoctor: (doctor: Omit<Doctor, 'id'>) => Promise<boolean>;
  updateDoctor: (id: string, doctor: Partial<Doctor>) => Promise<boolean>;
  calculateDoctorCommission: (doctorId: string, paidAmount: number) => number;
  toggleDoctorActive: (id: string) => Promise<void>;
  getDoctorById: (id: string) => Doctor | undefined;

  // Currency
  currency: CurrencyCode;
  setCurrency: (code: CurrencyCode) => Promise<void>;
  getCurrencySymbol: (language: 'en' | 'ar') => string;
  formatCurrency: (amount: number, language: 'en' | 'ar') => string;

  // Clinic Info
  clinicInfo: ClinicInfo;
  updateClinicInfo: (info: Partial<ClinicInfo>) => Promise<void>;

  // Refresh data
  refreshData: () => Promise<void>;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

interface SettingsProviderProps {
  children: ReactNode;
}

export const SettingsProvider: React.FC<SettingsProviderProps> = ({ children }) => {
  const { clinicId, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [services, setServices] = useState<Service[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [currency, setCurrencyState] = useState<CurrencyCode>('EGP');
  const [clinicInfo, setClinicInfo] = useState<ClinicInfo>(DEFAULT_CLINIC_INFO);

  // Fetch all data from Supabase
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Fetch Local Data
      try {
        const localData = await settingsService.getClinicInfo();
        if (localData) {
          setClinicInfo({
            id: localData.id,
            name: localData.clinic_name || '',
            ownerName: localData.owner_name || '',
            address: localData.address || '',
            phone: localData.phone || '',
            whatsappNumber: localData.whatsapp_number || '',
            email: localData.email || '',
            logo: localData.clinic_logo || '',
          });
          setCurrencyState((localData.currency as CurrencyCode) || 'EGP');
        }
      } catch (error) {
        console.error('Local settings fetch failed:', error);
      }

      // Fetch services (Always fetch local)
      const servicesData = await db.services.getAll();
      if (servicesData) {
        setServices(servicesData.map((s: any) => ({
          id: s.id,
          name: s.name,
          defaultPrice: Number(s.default_price) || 0,
        })));
      }

      // Fetch cities (Always fetch local)
      const citiesData = await db.cities.getAll();
      if (citiesData) {
        setCities(citiesData.map((c: any) => ({
          id: c.id,
          name: c.name,
        })));
      }

      // Fetch doctors (Always fetch local)
      const doctorsData = await db.doctors.getAll();
      if (doctorsData) {
        setDoctors(doctorsData.map((d: any) => ({
          id: d.id,
          name: d.name,
          role: (d.role as 'doctor' | 'assistant' | 'hygienist') || 'doctor',
          active: d.active === 1 || d.active === true,
          commissionType: (d.commission_type as 'percentage' | 'fixed') || 'percentage',
          commissionValue: Number(d.commission_value) || 0,
        })));
      }

    } catch (error) {
      console.error('Error fetching settings:', error);
    } finally {
      setLoading(false);
    }
  }, [clinicId, user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Service methods
  const addService = async (service: Omit<Service, 'id'>): Promise<boolean> => {
    // Local DB does not use clinic_id for services/cities/doctors
    const { data, error } = await db.services.create({
      name: service.name,
      default_price: service.defaultPrice,
    });

    if (!error && data) {
      setServices(prev => [...prev, {
        id: data.id,
        name: data.name,
        defaultPrice: Number(data.default_price),
      }]);
      return true;
    }
    console.error('Failed to add service:', error);
    return false;
  };

  const updateService = async (id: string, updates: Partial<Service>): Promise<boolean> => {
    const { error } = await db.services.update(id, {
      ...(updates.name && { name: updates.name }),
      ...(updates.defaultPrice !== undefined && { default_price: updates.defaultPrice }),
    });

    if (!error) {
      setServices(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
      return true;
    }
    console.error('Failed to update service:', error);
    return false;
  };

  const deleteService = async (id: string) => {
    const { error } = await db.services.delete(id);

    if (!error) {
      setServices(prev => prev.filter(s => s.id !== id));
    }
  };

  const getServiceById = (id: string) => services.find(s => s.id === id);

  // City methods
  const addCity = async (city: Omit<City, 'id'>): Promise<boolean> => {
    const { data, error } = await db.cities.create({
      name: city.name,
    });

    if (!error && data) {
      setCities(prev => [...prev, {
        id: data.id,
        name: data.name,
      }]);
      return true;
    }
    console.error('Failed to add city:', error);
    return false;
  };

  const updateCity = async (id: string, updates: Partial<City>): Promise<boolean> => {
    const { error } = await db.cities.update(id, {
      ...(updates.name && { name: updates.name }),
    });

    if (!error) {
      setCities(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
      return true;
    }
    console.error('Failed to update city:', error);
    return false;
  };

  const deleteCity = async (id: string) => {
    const { error } = await db.cities.delete(id);

    if (!error) {
      setCities(prev => prev.filter(c => c.id !== id));
    }
  };

  // Doctor methods
  const activeDoctors = doctors.filter(d => d.active);

  const addDoctor = async (doctor: Omit<Doctor, 'id'>): Promise<boolean> => {
    const { data, error } = await db.doctors.create({
      name: doctor.name,
      role: doctor.role,
      active: doctor.active ? 1 : 0,
      commission_type: doctor.commissionType,
      commission_value: doctor.commissionValue,
    });

    if (!error && data) {
      setDoctors(prev => [...prev, {
        id: data.id,
        name: data.name,
        role: data.role,
        active: Boolean(data.active),
        commissionType: data.commission_type,
        commissionValue: Number(data.commission_value),
      }]);
      return true;
    }
    console.error('Failed to add doctor:', error);
    return false;
  };

  const updateDoctor = async (id: string, updates: Partial<Doctor>): Promise<boolean> => {
    const { error } = await db.doctors.update(id, {
      ...(updates.name && { name: updates.name }),
      ...(updates.role && { role: updates.role }),
      ...(updates.active !== undefined && { active: updates.active ? 1 : 0 }),
      ...(updates.commissionType && { commission_type: updates.commissionType }),
      ...(updates.commissionValue !== undefined && { commission_value: updates.commissionValue }),
    });

    if (!error) {
      setDoctors(prev => prev.map(d => d.id === id ? { ...d, ...updates } : d));
      return true;
    }
    console.error('Failed to update doctor:', error);
    return false;
  };

  const toggleDoctorActive = async (id: string) => {
    const doctor = doctors.find(d => d.id === id);
    if (!doctor) return;

    await updateDoctor(id, { active: !doctor.active });
  };

  const getDoctorById = (id: string) => doctors.find(d => d.id === id);

  const calculateDoctorCommission = (doctorId: string, paidAmount: number): number => {
    const doctor = getDoctorById(doctorId);
    if (!doctor || !doctor.commissionType || !doctor.commissionValue) return 0;

    if (doctor.commissionType === 'percentage') {
      return (paidAmount * doctor.commissionValue) / 100;
    }
    return doctor.commissionValue;
  };

  // Currency methods
  const setCurrency = async (code: CurrencyCode) => {
    // 1. Update State
    setCurrencyState(code);

    // 2. Sync Local
    const syncData = {
      id: clinicInfo.id,
      name: clinicInfo.name,
      ownerName: clinicInfo.ownerName,
      address: clinicInfo.address,
      phone: clinicInfo.phone,
      whatsappNumber: clinicInfo.whatsappNumber,
      email: clinicInfo.email,
      logo: clinicInfo.logo,
      currency: code
    };
    try {
      await settingsService.syncClinicInfo(syncData);
    } catch (e) {
      console.error('Local sync failed', e);
    }
  };

  const getCurrencySymbol = (_language: 'en' | 'ar') => {
    const currencyOption = CURRENCY_OPTIONS.find(c => c.code === currency);
    return currencyOption?.symbol || currency;
  };

  const formatCurrency = (amount: number, language: 'en' | 'ar') => {
    const symbol = getCurrencySymbol(language);
    const safeAmount = (amount === undefined || amount === null || isNaN(amount)) ? 0 : amount;
    return `${symbol} ${safeAmount.toLocaleString()}`;
  };

  // Clinic Info methods
  const updateClinicInfo = async (info: Partial<ClinicInfo>) => {
    try {
      // 1. Immediate State Update (Optimistic)
      // Creates a new object to trigger React re-renders immediately
      const updatedInfo = { ...clinicInfo, ...info };
      setClinicInfo(updatedInfo);

      // 2. Persist to Local SQLite
      // We use 'settings:save-clinic-info' which expects the full object with camelCase keys
      // It will handle the mapping to snake_case for the DB internally in the main process
      const syncData = {
        ...updatedInfo,
        logo: updatedInfo.logo || '', // Ensure explicitly string
        currency: currency // Include currency from current state to ensure consistency
      };

      // Note: Cloud sync removed as per user request. Local only.
      await settingsService.syncClinicInfo(syncData);
    } catch (error) {
      console.error('Failed to update clinic info:', error);
      // Optional: Rollback state if save fails, but for settings, usually we just log error
    }
  };

  const refreshData = async () => {
    await fetchData();
  };

  return (
    <SettingsContext.Provider value={{
      loading,
      services,
      addService,
      updateService,
      deleteService,
      getServiceById,
      cities,
      addCity,
      updateCity,
      deleteCity,
      doctors,
      activeDoctors,
      addDoctor,
      updateDoctor,
      toggleDoctorActive,
      getDoctorById,
      calculateDoctorCommission,
      currency,
      setCurrency,
      getCurrencySymbol,
      formatCurrency,
      clinicInfo,
      updateClinicInfo,
      refreshData,
    }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = (): SettingsContextType => {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};