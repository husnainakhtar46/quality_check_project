import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, FileText, ClipboardCheck, Users, X } from 'lucide-react';
import { cn } from '../lib/utils';
import { useEffect } from 'react';

interface MobileSidebarProps {
    isOpen: boolean;
    onClose: () => void;
}

const MobileSidebar = ({ isOpen, onClose }: MobileSidebarProps) => {
    const location = useLocation();
    const isSuperUser = localStorage.getItem('is_superuser') === 'true';

    const allLinks = [
        { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, adminOnly: true },
        { href: '/inspections', label: 'Sample Evaluation', icon: ClipboardCheck, adminOnly: false },
        { href: '/templates', label: 'Templates', icon: FileText, adminOnly: false },
        { href: '/customers', label: 'Customers', icon: Users, adminOnly: true },
    ];

    const links = allLinks.filter(link => isSuperUser || !link.adminOnly);

    // Close sidebar when route changes
    useEffect(() => {
        onClose();
    }, [location.pathname, onClose]);

    // Prevent body scroll when sidebar is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [isOpen]);

    return (
        <>
            {/* Backdrop */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 md:hidden"
                    onClick={onClose}
                />
            )}

            {/* Sidebar */}
            <div
                className={cn(
                    "fixed top-0 left-0 h-full w-64 bg-white z-50 transform transition-transform duration-300 ease-in-out md:hidden",
                    isOpen ? "translate-x-0" : "-translate-x-full"
                )}
            >
                <div className="flex flex-col h-full">
                    {/* Header */}
                    <div className="flex items-center justify-between p-6 border-b border-gray-200">
                        <h1 className="text-2xl font-bold text-primary">Fit Flow</h1>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-gray-100 rounded-lg touch-target"
                        >
                            <X className="w-6 h-6" />
                        </button>
                    </div>

                    {/* Navigation Links */}
                    <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
                        {links.map((link) => {
                            const Icon = link.icon;
                            const isActive = location.pathname.startsWith(link.href);
                            return (
                                <Link
                                    key={link.href}
                                    to={link.href}
                                    className={cn(
                                        "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors touch-target",
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
                </div>
            </div>
        </>
    );
};

export default MobileSidebar;
