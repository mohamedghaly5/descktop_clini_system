import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter, Routes, Route } from "react-router-dom";
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
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import Pricing from "./pages/Pricing";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ForgotPassword from "./pages/ForgotPassword";
import UpdatePassword from "./pages/UpdatePassword";
import NotFound from "./pages/NotFound";

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
              <HashRouter>
                <Routes>
                  {/* Auth Routes */}
                  <Route path="/login" element={<Login />} />
                  <Route path="/signup" element={<Signup />} />
                  <Route path="/forgot-password" element={<ForgotPassword />} />
                  <Route path="/update-password" element={<UpdatePassword />} />

                  {/* Protected Routes */}
                  <Route element={
                    <ProtectedRoute>
                      <MainLayout />
                    </ProtectedRoute>
                  }>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/patients" element={<Patients />} />
                    <Route path="/patients/new" element={<NewPatient />} />
                    <Route path="/patients/:id" element={<PatientDetails />} />
                    <Route path="/appointments" element={<Appointments />} />
                    <Route path="/accounts" element={<Accounts />} />
                    <Route path="/reports" element={<Reports />} />
                    <Route path="/pricing" element={<Pricing />} />
                    <Route path="/settings" element={<Settings />} />
                  </Route>

                  <Route path="*" element={<NotFound />} />
                </Routes>
              </HashRouter>
            </TooltipProvider>
          </PricingProvider>
        </SettingsProvider>
      </AuthProvider>
    </LanguageProvider>
  </QueryClientProvider>
);

export default App;
