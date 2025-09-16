
'use client';

import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Menu, LogOut } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';

interface HeaderProps {
  onToggleSidebar: () => void;
}

export function Header({ onToggleSidebar }: HeaderProps) {
  const { user, logout } = useAuth();
  return (
    <header className="bg-white shadow-sm h-20 flex items-center justify-between px-6 flex-shrink-0 print:hidden">
      <Button
        variant="ghost"
        size="icon"
        onClick={onToggleSidebar}
        className="text-gray-600 hover:text-gray-800"
      >
        <Menu className="h-7 w-7" />
        <span className="sr-only">Toggle Sidebar</span>
      </Button>
      <div className="flex items-center gap-4">
        <span className="font-semibold text-slate-700 hidden sm:inline">Welcome, {user?.email || 'Admin'}!</span>
         <Avatar>
            <AvatarImage src={`https://picsum.photos/seed/${user?.uid}/40/40`} />
            <AvatarFallback>{user?.email?.charAt(0).toUpperCase() || 'A'}</AvatarFallback>
        </Avatar>
        <Button variant="ghost" size="icon" onClick={logout}>
          <LogOut className="h-5 w-5" />
          <span className="sr-only">Sign Out</span>
        </Button>
      </div>
    </header>
  );
}
