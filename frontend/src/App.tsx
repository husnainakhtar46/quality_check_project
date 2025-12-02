import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { Toaster } from './components/ui/toaster';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Templates from './pages/Templates';
import Inspections from './pages/Inspections';
import Customers from './pages/Customers';
import CustomerFeedback from './pages/CustomerFeedback';
import FinalInspections from './pages/FinalInspections';
import Sidebar from './components/Sidebar';
import MobileNav from './components/MobileNav';
import MobileHeader from './components/MobileHeader';
import MobileSidebar from './components/MobileSidebar';

const queryClient = new QueryClient();

const Layout = () => {
    const token = localStorage.getItem('access_token');
    const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

    if (!token) return <Navigate to="/login" />;

    return (
        <div className="flex h-screen bg-gray-100">
            {/* Desktop Sidebar */}
            <Sidebar />

            {/* Mobile Navigation */}
            <MobileHeader onMenuClick={() => setMobileSidebarOpen(true)} />
            <MobileSidebar
                isOpen={mobileSidebarOpen}
                onClose={() => setMobileSidebarOpen(false)}
            />

            {/* Main Content */}
            <main className="flex-1 overflow-y-auto p-4 md:p-8 pt-16 pb-20 md:pt-8 md:pb-8 relative z-10">
                <Outlet />
            </main>

            {/* Mobile Bottom Nav */}
            <MobileNav />
        </div>
    );
};

const HomeRedirect = () => {
    const isSuperUser = localStorage.getItem('is_superuser') === 'true';
    return <Navigate to={isSuperUser ? "/dashboard" : "/inspections"} />;
};

function App() {
    return (
        <QueryClientProvider client={queryClient}>
            <Router>
                <Routes>
                    <Route path="/login" element={<Login />} />
                    <Route element={<Layout />}>
                        <Route path="/" element={<HomeRedirect />} />
                        <Route path="/dashboard" element={<Dashboard />} />
                        <Route path="/templates" element={<Templates />} />
                        <Route path="/inspections" element={<Inspections />} />
                        <Route path="/final-inspections" element={<FinalInspections />} />
                        <Route path="/customer-feedback" element={<CustomerFeedback />} />
                        <Route path="/customers" element={<Customers />} />
                    </Route>
                </Routes>
            </Router>
            <Toaster />
        </QueryClientProvider>
    );
}

export default App;
