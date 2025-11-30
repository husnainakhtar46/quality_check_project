import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, FileText, ClipboardCheck, Users } from 'lucide-react';
import { cn } from '../lib/utils';

const MobileNav = () => {
    const location = useLocation();
    const isSuperUser = localStorage.getItem('is_superuser') === 'true';

    const allLinks = [
        { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, adminOnly: true },
        { href: '/inspections', label: 'Inspections', icon: ClipboardCheck, adminOnly: false },
        { href: '/templates', label: 'Templates', icon: FileText, adminOnly: false },
        { href: '/customers', label: 'Customers', icon: Users, adminOnly: true },
    ];

    const links = allLinks.filter(link => isSuperUser || !link.adminOnly);

    return (
        <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 md:hidden safe-bottom">
            <div className="flex justify-around items-center h-16">
                {links.map((link) => {
                    const Icon = link.icon;
                    const isActive = location.pathname.startsWith(link.href);
                    return (
                        <Link
                            key={link.href}
                            to={link.href}
                            className={cn(
                                "flex flex-col items-center justify-center flex-1 h-full gap-1 transition-colors touch-target",
                                isActive
                                    ? "text-primary"
                                    : "text-gray-600"
                            )}
                        >
                            <Icon className={cn("w-6 h-6", isActive && "stroke-[2.5]")} />
                            <span className="text-xs font-medium">{link.label}</span>
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
};

export default MobileNav;
