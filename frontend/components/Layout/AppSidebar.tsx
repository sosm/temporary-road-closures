"use client"
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  BarChart3, 
  Map as MapIcon, 
  Route, 
  BookOpen, 
  User, 
  LogOut, 
  LogIn,
  Info,
  ShieldCheck,
  Bell,
  TriangleAlert,
  Construction
} from 'lucide-react';

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar';
import { useClosures } from '@/context/ClosuresContext';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/utils/utils';

const navItems = [
  {
    title: 'Dashboard',
    url: '/dashboard',
    icon: BarChart3,
  },
  {
    title: 'Map View',
    url: '/closures',
    icon: MapIcon,
  },
  {
    title: 'Closure-Aware Routing',
    url: '/closure-aware-routing',
    icon: Route,
  },
  {
    title: 'Documentation',
    url: '/docs',
    icon: BookOpen,
  },
  {
    title: 'Privacy Policy',
    url: '/privacy',
    icon: ShieldCheck,
  },
];

export function AppSidebar() {
  const pathname = usePathname();
  const { state: closuresState, logout } = useClosures();
  const { isAuthenticated, user } = closuresState;
  const { state: sidebarCollapsibleState } = useSidebar();
  const isCollapsed = sidebarCollapsibleState === "collapsed";

  const activeIndex = navItems.findIndex(
    (item) => pathname === item.url || pathname?.startsWith(item.url + '/')
  );

  const itemHeight = isCollapsed ? 40 : 32;

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="bg-white border-b p-2 h-16 flex items-center group-data-[collapsible=icon]:justify-center transition-all duration-300">
        <div className="flex items-center w-full h-full">
          <Link href="/" className="flex items-center space-x-2.5 group-data-[collapsible=icon]:hidden min-w-0 flex-1 hover:opacity-80 transition-opacity ml-1">
            <div className="flex items-center justify-center w-9 h-9 bg-blue-600 rounded-lg shrink-0 shadow-sm transition-all duration-200">
              <Construction className="w-5 h-5 text-white" />
            </div>
            <div className="flex flex-col leading-tight">
              <span className="font-bold text-sm text-gray-900 tracking-tight">OSM Road Closures</span>
              <span className="text-[10px] text-gray-500 font-medium">Internal Platform</span>
            </div>
          </Link>
          <SidebarTrigger className="hidden md:inline-flex ml-auto group-data-[collapsible=icon]:m-0 group-data-[collapsible=icon]:mx-auto shrink-0 transition-colors" />
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="relative">
              {/* Sliding Highlight Background */}
              {activeIndex !== -1 && (
                <div 
                  className={cn(
                    "absolute left-0 right-0 rounded-lg bg-blue-600 transition-all duration-300 ease-in-out z-0 shadow-sm",
                    isCollapsed ? "h-10 w-10 mx-auto" : "h-9"
                  )}
                  style={{
                    transform: `translateY(${activeIndex * (isCollapsed ? 40 : 36)}px)`,
                  }}
                />
              )}
              {navItems.map((item, index) => (
                <SidebarMenuItem key={item.title} className="relative z-10">
                  <SidebarMenuButton 
                    id={`sidebar-nav-${item.url.replace(/\//g, "-").replace(/^-+/, "") || "home"}`}
                    render={<Link href={item.url} />}
                    isActive={false}
                    tooltip={item.title}
                    className={cn(
                      "transition-all duration-300 rounded-lg group-data-[collapsible=icon]:rounded-lg h-9 font-medium",
                      index === activeIndex 
                        ? "!text-white shadow-none !bg-transparent hover:!text-white" 
                        : "!text-gray-600 bg-transparent hover:!text-gray-600"
                    )}
                  >
                    <item.icon className={cn(
                      "transition-colors duration-300",
                      index === activeIndex ? "text-white" : "text-gray-500"
                    )} />
                    <span className="group-data-[collapsible=icon]:hidden">{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>



        {/* Alerts Section */}
        <SidebarGroup className="flex-1 group-data-[collapsible=icon]:hidden">
          <SidebarGroupLabel>
            <Bell className="w-3 h-3 mr-1" />
            Alerts
          </SidebarGroupLabel>
          <SidebarGroupContent className="px-2 space-y-2 overflow-y-auto">
            {!isAuthenticated && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="flex items-start space-x-2">
                  <Info className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <h4 className="text-xs font-semibold text-blue-900 mb-1">
                      Login Required for Full Features
                    </h4>
                    <p className="text-xs text-blue-700 leading-relaxed">
                      You can view closures, but need to log in to report new ones or edit existing closures.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {isAuthenticated && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <div className="flex items-start space-x-2">
                  <ShieldCheck className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <h4 className="text-xs font-semibold text-green-900 mb-1">
                      Full Access Enabled
                    </h4>
                    <p className="text-xs text-green-700 leading-relaxed">
                      You can create, edit, and delete road closures.
                    </p>
                  </div>
                </div>
              </div>
            )}



            {pathname === '/closures' && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <div className="flex items-start space-x-2">
                  <Bell className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <h4 className="text-xs font-semibold text-amber-900 mb-1">
                      Tip
                    </h4>
                    <p className="text-xs text-amber-700 leading-relaxed">
                      Use the &quot;Report Closure&quot; button in the map view panel to add new road closures, or hover over existing closures in the list to edit them.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-gray-200 bg-gray-50 p-4 group-data-[collapsible=icon]:p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            {isAuthenticated ? (
              <DropdownMenu>
                <DropdownMenuTrigger className="w-full focus:outline-none focus:ring-2 focus:ring-sidebar-ring rounded-md">
                  <SidebarMenuButton size="lg" render={<div />} className="w-full cursor-pointer hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
                    <Avatar className="h-8 w-8 rounded-full group-data-[collapsible=icon]:h-10 group-data-[collapsible=icon]:w-10 transition-all duration-200">
                      <AvatarFallback className="rounded-full bg-blue-100 text-blue-700 text-xs text-[10px] font-black uppercase">
                        {user?.full_name 
                          ? user.full_name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase()
                          : user?.username?.substring(0, 2).toUpperCase() || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
                      <span className="truncate font-bold tracking-tight text-gray-900">{user?.full_name || user?.username}</span>
		      <span className="truncate text-xs text-gray-500">{user?.is_moderator ? 'Moderator' : 'Contributor'}</span>
                    </div>
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" side="top" sideOffset={8} className="w-[200px] p-2">
                  <div className="px-2 py-2 border-b border-gray-100 mb-1">
                    <p className="text-xs font-bold text-gray-900 truncate">{user?.full_name}</p>
                    <p className="text-[10px] text-gray-500 truncate lowercase">@{user?.username}</p>
                  </div>
                  <DropdownMenuItem disabled className="rounded-md opacity-50 cursor-not-allowed">
                    <User className="mr-2 h-4 w-4" />
                    Profile
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={logout} className="text-red-600">
                    <LogOut className="mr-2 h-4 w-4" />
                    Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Link
                href="/login"
                className="flex items-center justify-center w-full px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-full transition-all duration-200 group-data-[collapsible=icon]:w-10 group-data-[collapsible=icon]:h-10 group-data-[collapsible=icon]:mx-auto"
              >
                <LogIn className="h-4 w-4 shrink-0 group-data-[collapsible=icon]:h-5 group-data-[collapsible=icon]:w-5" />
                <span className="ml-2 group-data-[collapsible=icon]:hidden font-bold uppercase tracking-tighter text-[11px]">Login to Report</span>
              </Link>
            )}
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
