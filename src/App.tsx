import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Routes, Route } from "react-router-dom";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { SettingsProvider } from "@/contexts/SettingsContext";
import { PricingProvider } from "@/contexts/PricingContext";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import MainLayout from "@/components/layout/MainLayout";
import Dashboard from "./pages/Index";
import Patients from "./pages/Patients";
import PatientDetails from "./pages/PatientDetails";
import NewPatient from "./pages/NewPatient";
import Appointments from "./pages/Appointments";
import Accounts from "./pages/Accounts";
import Expenses from "./pages/Expenses";
import LabOrders from "./pages/LabOrders";

import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import Pricing from "./pages/Pricing";
import Login from "./pages/LocalLogin";
import SelectUser from "./pages/SelectUser";

import ForceChangePin from "./pages/ForceChangePin";
import CreateAdminWizard from "./pages/CreateAdminWizard";
import NotFound from "./pages/NotFound";
import LicenseSettings from "./pages/LicenseSettings";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <LanguageProvider>
      <AuthProvider>
        <SettingsProvider>
          <PricingProvider>
            <TooltipProvider>
              <Toaster />
              <Sonner />
              <Routes>
                {/* Auth Routes - Local Only */}
                <Route path="/select-user" element={<SelectUser />} />
                <Route path="/login" element={<SelectUser />} />
                <Route path="/create-admin" element={<CreateAdminWizard />} />

                <Route path="/change-pin" element={
                  <ProtectedRoute>
                    <ForceChangePin />
                  </ProtectedRoute>
                } />



                {/* Protected Routes */}
                <Route element={
                  <ProtectedRoute>
                    <MainLayout />
                  </ProtectedRoute>
                }>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/patients" element={<Patients />} />
                  <Route path="/patients/new" element={<NewPatient />} />
                  <Route path="/patients/:id" element={<PatientDetails />} />
                  <Route path="/appointments" element={<Appointments />} />
                  <Route path="/lab-orders" element={<LabOrders />} />
                  <Route path="/accounts" element={<Accounts />} />
                  <Route path="/expenses" element={<Expenses />} />
                  <Route path="/reports" element={<Reports />} />
                  <Route path="/pricing" element={<Pricing />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="/license" element={<LicenseSettings />} />
                </Route>

                <Route path="*" element={<NotFound />} />
              </Routes>
            </TooltipProvider>
          </PricingProvider>
        </SettingsProvider>
      </AuthProvider>
    </LanguageProvider>
  </QueryClientProvider>
);

export default App;
