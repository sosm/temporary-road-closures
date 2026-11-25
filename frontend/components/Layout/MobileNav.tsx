"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BarChart3, Map, Route, BookOpen, User, LogOut, LogIn } from 'lucide-react';
import { cn } from '@/utils/utils';
import { useClosures } from '@/context/ClosuresContext';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';

const mobileNavItems = [
  {
    title: 'Dashboard',
    url: '/dashboard',
    icon: BarChart3,
  },
  {
    title: 'Map View',
    url: '/closures',
    icon: Map,
  },
  {
    title: 'Routing',
    url: '/closure-aware-routing',
    icon: Route,
  },
  {
    title: 'Documentation',
    url: '/docs',
    icon: BookOpen,
  },
  {
    title: 'Profile',
    url: '/profile', // Popover trigger
    icon: User,
  },
];

export function MobileNav() {
  const pathname = usePathname();
  const { state, logout } = useClosures();
  const { isAuthenticated, user } = state;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[1100] md:hidden bg-white border-t border-gray-100 shadow-none pt-2 pb-5">
      <nav className="w-full flex items-center justify-around">
        {mobileNavItems.map((item) => {
          const isActive = pathname === item.url || (item.url !== '/' && pathname?.startsWith(item.url));
          const Icon = item.icon;
          
          if (item.title === 'Profile') {
            return (
              <Popover key={item.title}>
                <PopoverTrigger
                  id="mobile-profile-menu-trigger"
                  className="flex flex-col items-center justify-center transition-all duration-300 focus:outline-none bg-transparent hover:bg-transparent border-none p-0 h-auto"
                >
                    <div className={cn(
                      "p-2 transition-all duration-300 flex items-center justify-center",
                      isActive ? "text-slate-900 active:scale-95" : "text-slate-400 active:scale-95"
                    )}>
                      {isAuthenticated ? (
                        <Avatar className="h-6 w-6 border border-gray-100">
                          <AvatarFallback className="text-[8px] font-black bg-blue-50 text-blue-600">
                            {user?.full_name?.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase() || 'U'}
                          </AvatarFallback>
                        </Avatar>
                      ) : (
                        <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
                      )}
                    </div>
                    
                    <div className="h-1.5 flex items-center justify-center -mt-1">
                      <div className={cn(
                        "w-1.5 h-1.5 rounded-full bg-blue-600 transition-all duration-300",
                        isActive ? "opacity-100 scale-100" : "opacity-0 scale-0"
                      )} />
                    </div>
                </PopoverTrigger>
                <PopoverContent side="top" align="center" className="w-[200px] p-2 mb-2 bg-white/95 backdrop-blur-xl border border-gray-100 shadow-2xl rounded-xl z-[2000]">
                  {isAuthenticated ? (
                    <div className="flex flex-col">
                      <div className="px-2 py-2 border-b border-gray-100 mb-1">
                        <p className="text-xs font-bold text-gray-900 truncate">{user?.full_name}</p>
                        <p className="text-[10px] text-gray-500 truncate lowercase">@{user?.username}</p>
                      </div>
                      
                      <button disabled className="w-full flex items-center px-2 py-1.5 rounded-md text-sm text-gray-400 opacity-50 cursor-not-allowed">
                        <User className="mr-2 h-4 w-4" />
                        Profile
                      </button>
                      <Link href="/privacy" className="w-full px-2 py-1.5 text-sm text-gray-700">
                        Privacy Policy
                      </Link>
                      
                      <button onClick={logout} className="w-full flex items-center px-2 py-1.5 rounded-md text-sm text-red-600 hover:bg-red-50 transition-colors">
                        <LogOut className="mr-2 h-4 w-4" />
                        Logout
                      </button>
                    </div>
                  ) : (
                    <div className="p-1 space-y-2">
                      <div className="p-3 text-center space-y-2">
                        <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center mx-auto">
                          <User className="w-5 h-5 text-blue-600" />
                        </div>
                        <p className="text-xs font-bold text-gray-600">You are in Demo Mode</p>
                      </div>
                      <Link href="/login" passHref className="block">
                        <Button className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white font-black uppercase tracking-widest rounded-xl text-[10px]">
                          <LogIn className="mr-2 h-4 w-4" />
                          Login to Report
                        </Button>
                      </Link>

		      <Link href="/privacy" className="block px-2 py-1.5 text-center text-sm text-gray-700">
                        Privacy Policy
                      </Link>
                    </div>
                  )}
                </PopoverContent>
              </Popover>
            );
          }

          return (
            <Link
              key={item.title}
              href={item.url}
              className="flex flex-col items-center justify-center transition-all duration-300"
            >
              <div className={cn(
                "p-2 transition-all duration-300 flex items-center justify-center",
                isActive ? "text-slate-900 active:scale-95" : "text-slate-400 active:scale-95"
              )}>
                <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
              </div>
              
              <div className="h-1.5 flex items-center justify-center -mt-1">
                <div className={cn(
                  "w-1.5 h-1.5 rounded-full bg-blue-600 transition-all duration-300",
                  isActive ? "opacity-100 scale-100" : "opacity-0 scale-0"
                )} />
              </div>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
