import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from './components/ui/toaster';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Templates from './pages/Templates';
import Inspections from './pages/Inspections';
import Customers from './pages/Customers';
import Sidebar from './components/Sidebar';

const queryClient = new QueryClient();

const Layout = () => {
    const token = localStorage.getItem('access_token');
    if (!token) return <Navigate to="/login" />;

    return (
        <div className="flex h-screen bg-gray-100">
            <Sidebar />
            <main className="flex-1 overflow-y-auto p-8">
                <Outlet />
            </main>
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
                        <Route path="/customers" element={<Customers />} />
                    </Route>
                </Routes>
            </Router>
            <Toaster />
        </QueryClientProvider>
    );
}

export default App;
