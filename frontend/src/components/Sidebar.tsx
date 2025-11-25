import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, FileText, ClipboardCheck, Users, LogOut } from 'lucide-react';
import { cn } from '../lib/utils';

const Sidebar = () => {
    const location = useLocation();

    const isSuperUser = localStorage.getItem('is_superuser') === 'true';

    const allLinks = [
        { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, adminOnly: true },
        { href: '/inspections', label: 'Inspections', icon: ClipboardCheck, adminOnly: false },
        { href: '/templates', label: 'Templates', icon: FileText, adminOnly: false },
        { href: '/customers', label: 'Customers', icon: Users, adminOnly: true },
    ];

    const links = allLinks.filter(link => isSuperUser || !link.adminOnly);

    const handleLogout = () => {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('is_superuser');
        window.location.href = '/login';
    };

    return (
        <div className="w-64 bg-white border-r border-gray-200 flex flex-col">
            <div className="p-6 border-b border-gray-200">
                <h1 className="text-2xl font-bold text-primary">QC System</h1>
            </div>
            <nav className="flex-1 p-4 space-y-2">
                {links.map((link) => {
                    const Icon = link.icon;
                    const isActive = location.pathname.startsWith(link.href);
                    return (
                        <Link
                            key={link.href}
                            to={link.href}
                            className={cn(
                                "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors",
                                isActive
                                    ? "bg-primary text-primary-foreground"
                                    : "text-gray-600 hover:bg-gray-100"
                            )}
                        >
                            <Icon className="w-5 h-5" />
                            {link.label}
                        </Link>
                    );
                })}
            </nav>
            <div className="p-4 border-t border-gray-200">
                <button
                    onClick={handleLogout}
                    className="flex items-center gap-3 px-4 py-3 w-full text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                    <LogOut className="w-5 h-5" />
                    Logout
                </button>
            </div>
        </div>
    );
};

export default Sidebar;
