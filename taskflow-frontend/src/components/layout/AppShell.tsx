"use client";

import { Bell, LayoutDashboard, ListChecks, Loader2, LogOut, Moon, Sun } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import { Avatar } from "@/components/ui/Avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/DropdownMenu";
import { useAuth } from "@/lib/auth/AuthProvider";
import { cn } from "@/lib/utils";
import { Logo } from "./Logo";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/projects", label: "Projects", icon: ListChecks },
  { href: "/tasks", label: "All tasks", icon: ListChecks },
  { href: "/notifications", label: "Notifications", icon: Bell },
] as const;

function initialTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  const stored = window.localStorage.getItem("taskflow.theme");
  const value = stored === "dark" || stored === "light" ? stored : document.documentElement.getAttribute("data-theme");
  return value === "dark" ? "dark" : "light";
}

function useTheme() {
  const [theme, setTheme] = useState<"light" | "dark">(initialTheme);
  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    window.localStorage.setItem("taskflow.theme", next);
  };
  return { theme, toggle };
}

export function AppShell({ children }: { children: ReactNode }) {
  const { status, user, organizationName, isAdmin, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { theme, toggle } = useTheme();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [status, router, pathname]);

  if (status !== "authenticated" || !user) {
    return (
      <div className="flex h-dvh items-center justify-center bg-canvas">
        <Loader2 className="size-6 animate-spin text-ink-3" />
      </div>
    );
  }

  const handleLogout = async () => {
    await logout();
    router.replace("/login");
  };

  return (
    <div className="min-h-dvh bg-canvas">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[60] focus:rounded-md focus:bg-surface focus:px-3 focus:py-2 focus:shadow-pop"
      >
        Skip to content
      </a>

      {/* Top bar (mobile) + side rail (desktop) */}
      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line bg-surface/90 px-4 backdrop-blur-sm md:hidden">
        <Logo />
        <nav className="ml-auto flex items-center gap-1">
          <UserMenu name={user.name} email={user.email} org={organizationName} isAdmin={isAdmin} theme={theme} onToggleTheme={toggle} onLogout={handleLogout} />
        </nav>
      </header>

      <div className="mx-auto flex max-w-[1400px]">
        <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-line bg-surface px-3 py-4 md:flex">
          <div className="mb-6 px-2">
            <Logo />
          </div>
          <nav className="flex flex-1 flex-col gap-0.5">
            {NAV.map((item) => {
              const active = pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13.5px] font-medium transition-colors",
                    active ? "bg-brand-soft text-brand" : "text-ink-2 hover:bg-surface-2 hover:text-ink",
                  )}
                >
                  <item.icon className="size-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="mt-auto border-t border-line pt-3">
            <UserMenu
              name={user.name}
              email={user.email}
              org={organizationName}
              isAdmin={isAdmin}
              theme={theme}
              onToggleTheme={toggle}
              onLogout={handleLogout}
              full
            />
          </div>
        </aside>

        <main id="main" className="min-w-0 flex-1 pb-16 md:pb-0">
          {children}
        </main>
      </div>

      {/* Bottom tab bar (mobile) */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-line bg-surface/95 backdrop-blur-sm md:hidden">
        {NAV.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-1 flex-col items-center gap-0.5 py-2 text-[10.5px] font-medium",
                active ? "text-brand" : "text-ink-3",
              )}
            >
              <item.icon className="size-[18px]" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

function UserMenu({
  name,
  email,
  org,
  isAdmin,
  theme,
  onToggleTheme,
  onLogout,
  full,
}: {
  name: string;
  email: string;
  org: string | null;
  isAdmin: boolean;
  theme: "light" | "dark";
  onToggleTheme: () => void;
  onLogout: () => void;
  full?: boolean;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            "flex items-center gap-2 rounded-lg text-left transition-colors hover:bg-surface-2",
            full ? "w-full p-2" : "p-1",
          )}
        >
          <Avatar name={name} size="sm" />
          {full && (
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-medium text-ink">{name}</span>
              <span className="block truncate text-[11.5px] text-ink-3">{org ?? email}</span>
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={full ? "start" : "end"}>
        <div className="px-2.5 py-2">
          <p className="truncate text-[13px] font-medium text-ink">{name}</p>
          <p className="truncate text-[11.5px] text-ink-3">{email}</p>
          {isAdmin && <p className="mt-1 text-[11px] font-medium text-brand">Org admin</p>}
        </div>
        <div className="my-1 h-px bg-line" />
        <DropdownMenuItem onSelect={onToggleTheme}>
          {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
          {theme === "dark" ? "Light mode" : "Dark mode"}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onLogout} destructive>
          <LogOut className="size-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
