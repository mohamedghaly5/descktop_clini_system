import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export interface MaterialItem {
  id: string;
  productName: string;
  productPrice: number;
  casesServed: number;
  costPerCase: number;
}

export interface IncludedService {
  serviceId: string;
  materialsOnlyCost: number;
}

export interface PricedService {
  id: string;
  name: string;
  materials: MaterialItem[];
  includedServices: IncludedService[];
  serviceTimeHours: number;
  profitPercentage: number;
  // Calculated values
  totalMaterialsCost: number;
  timeCost: number;
  baseCost: number;
  profitValue: number;
  finalPrice: number;
}

export interface ClinicCostSettings {
  // Working hours
  workingHoursPerDay: number;
  workingDaysPerWeek: number;
  monthlyWorkingHours: number;
  
  // Equipment depreciation
  totalEquipmentCost: number;
  recoveryPeriodYears: number;
  hourlyEquipmentCost: number;
  
  // Fixed expenses
  rent: number;
  utilities: number;
  assistantSalary: number;
  doctorSalary: number;
  marketing: number;
  transportation: number;
  emergency: number;
  totalFixedExpenses: number;
  fixedHourlyCost: number;
  
  // Final hourly cost
  finalClinicHourlyCost: number;
}

interface PricingContextType {
  clinicCostSettings: ClinicCostSettings;
  updateClinicCostSettings: (settings: Partial<ClinicCostSettings>) => void;
  recalculateClinicCosts: () => void;
  
  pricedServices: PricedService[];
  addPricedService: (service: Omit<PricedService, 'id'>) => void;
  updatePricedService: (id: string, service: Partial<PricedService>) => void;
  deletePricedService: (id: string) => void;
  getPricedServiceById: (id: string) => PricedService | undefined;
  calculateServiceCosts: (service: Partial<PricedService>) => {
    totalMaterialsCost: number;
    timeCost: number;
    baseCost: number;
    profitValue: number;
    finalPrice: number;
  };
}

const DEFAULT_CLINIC_COST_SETTINGS: ClinicCostSettings = {
  workingHoursPerDay: 8,
  workingDaysPerWeek: 6,
  monthlyWorkingHours: 192,
  
  totalEquipmentCost: 0,
  recoveryPeriodYears: 5,
  hourlyEquipmentCost: 0,
  
  rent: 0,
  utilities: 0,
  assistantSalary: 0,
  doctorSalary: 0,
  marketing: 0,
  transportation: 0,
  emergency: 0,
  totalFixedExpenses: 0,
  fixedHourlyCost: 0,
  
  finalClinicHourlyCost: 0,
};

const PricingContext = createContext<PricingContextType | undefined>(undefined);

interface PricingProviderProps {
  children: ReactNode;
}

export const PricingProvider: React.FC<PricingProviderProps> = ({ children }) => {
  const [clinicCostSettings, setClinicCostSettings] = useState<ClinicCostSettings>(() => {
    const saved = localStorage.getItem('clinic_cost_settings');
    if (saved) {
      return JSON.parse(saved);
    }
    return DEFAULT_CLINIC_COST_SETTINGS;
  });

  const [pricedServices, setPricedServices] = useState<PricedService[]>(() => {
    const saved = localStorage.getItem('priced_services');
    if (saved) {
      return JSON.parse(saved);
    }
    return [];
  });

  // Persist to localStorage
  useEffect(() => {
    localStorage.setItem('clinic_cost_settings', JSON.stringify(clinicCostSettings));
  }, [clinicCostSettings]);

  useEffect(() => {
    localStorage.setItem('priced_services', JSON.stringify(pricedServices));
  }, [pricedServices]);

  const recalculateClinicCosts = () => {
    setClinicCostSettings(prev => {
      // Monthly working hours
      const monthlyWorkingHours = prev.workingHoursPerDay * prev.workingDaysPerWeek * 4;
      
      // Equipment hourly cost
      const annualEquipmentCost = prev.totalEquipmentCost / (prev.recoveryPeriodYears || 1);
      const monthlyEquipmentCost = annualEquipmentCost / 12;
      const dailyEquipmentCost = monthlyEquipmentCost / 30;
      const hourlyEquipmentCost = dailyEquipmentCost / (prev.workingHoursPerDay || 1);
      
      // Fixed expenses
      const totalFixedExpenses = 
        prev.rent + 
        prev.utilities + 
        prev.assistantSalary + 
        prev.doctorSalary + 
        prev.marketing + 
        prev.transportation + 
        prev.emergency;
      
      const fixedHourlyCost = totalFixedExpenses / (monthlyWorkingHours || 1);
      
      // Final hourly cost
      const finalClinicHourlyCost = hourlyEquipmentCost + fixedHourlyCost;
      
      return {
        ...prev,
        monthlyWorkingHours,
        hourlyEquipmentCost,
        totalFixedExpenses,
        fixedHourlyCost,
        finalClinicHourlyCost,
      };
    });
  };

  const updateClinicCostSettings = (settings: Partial<ClinicCostSettings>) => {
    setClinicCostSettings(prev => {
      const updated = { ...prev, ...settings };
      
      // Recalculate derived values
      const monthlyWorkingHours = updated.workingHoursPerDay * updated.workingDaysPerWeek * 4;
      
      const annualEquipmentCost = updated.totalEquipmentCost / (updated.recoveryPeriodYears || 1);
      const monthlyEquipmentCost = annualEquipmentCost / 12;
      const dailyEquipmentCost = monthlyEquipmentCost / 30;
      const hourlyEquipmentCost = dailyEquipmentCost / (updated.workingHoursPerDay || 1);
      
      const totalFixedExpenses = 
        updated.rent + 
        updated.utilities + 
        updated.assistantSalary + 
        updated.doctorSalary + 
        updated.marketing + 
        updated.transportation + 
        updated.emergency;
      
      const fixedHourlyCost = totalFixedExpenses / (monthlyWorkingHours || 1);
      const finalClinicHourlyCost = hourlyEquipmentCost + fixedHourlyCost;
      
      return {
        ...updated,
        monthlyWorkingHours,
        hourlyEquipmentCost,
        totalFixedExpenses,
        fixedHourlyCost,
        finalClinicHourlyCost,
      };
    });
  };

  const calculateServiceCosts = (service: Partial<PricedService>) => {
    // Materials cost from direct materials
    const directMaterialsCost = (service.materials || []).reduce(
      (sum, m) => sum + m.costPerCase, 
      0
    );
    
    // Materials cost from included services
    const includedMaterialsCost = (service.includedServices || []).reduce(
      (sum, s) => sum + s.materialsOnlyCost, 
      0
    );
    
    const totalMaterialsCost = directMaterialsCost + includedMaterialsCost;
    
    // Time cost (only main service time)
    const timeCost = (service.serviceTimeHours || 0) * clinicCostSettings.finalClinicHourlyCost;
    
    // Base cost
    const baseCost = totalMaterialsCost + timeCost;
    
    // Profit
    const profitValue = baseCost * ((service.profitPercentage || 0) / 100);
    
    // Final price
    const finalPrice = baseCost + profitValue;
    
    return {
      totalMaterialsCost,
      timeCost,
      baseCost,
      profitValue,
      finalPrice,
    };
  };

  const addPricedService = (service: Omit<PricedService, 'id'>) => {
    const costs = calculateServiceCosts(service);
    const newService: PricedService = {
      ...service,
      ...costs,
      id: Date.now().toString(),
    };
    setPricedServices(prev => [...prev, newService]);
  };

  const updatePricedService = (id: string, updates: Partial<PricedService>) => {
    setPricedServices(prev => prev.map(s => {
      if (s.id === id) {
        const updated = { ...s, ...updates };
        const costs = calculateServiceCosts(updated);
        return { ...updated, ...costs };
      }
      return s;
    }));
  };

  const deletePricedService = (id: string) => {
    setPricedServices(prev => prev.filter(s => s.id !== id));
  };

  const getPricedServiceById = (id: string) => pricedServices.find(s => s.id === id);

  return (
    <PricingContext.Provider value={{
      clinicCostSettings,
      updateClinicCostSettings,
      recalculateClinicCosts,
      pricedServices,
      addPricedService,
      updatePricedService,
      deletePricedService,
      getPricedServiceById,
      calculateServiceCosts,
    }}>
      {children}
    </PricingContext.Provider>
  );
};

export const usePricing = (): PricingContextType => {
  const context = useContext(PricingContext);
  if (context === undefined) {
    throw new Error('usePricing must be used within a PricingProvider');
  }
  return context;
};
