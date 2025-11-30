import { Menu, LogOut } from 'lucide-react';
import { Button } from './ui/button';

interface MobileHeaderProps {
    onMenuClick: () => void;
}

const MobileHeader = ({ onMenuClick }: MobileHeaderProps) => {
    const handleLogout = () => {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('is_superuser');
        window.location.href = '/login';
    };

    return (
        <header className="fixed top-0 left-0 right-0 z-40 bg-white border-b border-gray-200 md:hidden">
            <div className="flex items-center justify-between h-14 px-4">
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={onMenuClick}
                    className="touch-target"
                >
                    <Menu className="w-6 h-6" />
                </Button>

                <h1 className="text-lg font-bold text-primary">Fit Flow</h1>

                <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleLogout}
                    className="touch-target text-red-600"
                >
                    <LogOut className="w-5 h-5" />
                </Button>
            </div>
        </header>
    );
};

export default MobileHeader;
