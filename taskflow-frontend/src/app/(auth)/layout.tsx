"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

import { useAuth } from "@/lib/auth/AuthProvider";

export default function AuthLayout({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === "authenticated") router.replace("/dashboard");
  }, [status, router]);

  if (status === "authenticated") {
    return (
      <div className="flex h-dvh items-center justify-center bg-canvas">
        <Loader2 className="size-6 animate-spin text-ink-3" />
      </div>
    );
  }

  return (
    <div className="grid min-h-dvh grid-cols-1 lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-[#0b2030] p-10 text-white lg:flex">
        <div
          className="absolute inset-0 opacity-[0.14]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 20%, white 1px, transparent 1px), radial-gradient(circle at 60% 70%, white 1px, transparent 1px)",
            backgroundSize: "34px 34px, 46px 46px",
          }}
        />
        <div className="relative flex items-center gap-2 font-display text-[17px] font-bold">
          <span className="flex size-7 items-center justify-center rounded-md bg-white/15 text-[14px]">T</span>
          TaskFlow
        </div>
        <div className="relative max-w-md">
          <p className="font-display text-[28px] font-bold leading-tight">
            Organize projects, assign work, and keep every team in sync.
          </p>
          <p className="mt-3 text-[14px] text-white/70">
            Multi-tenant boards with role-based access, live task assignment, and background
            notifications — built on a real Node.js + Postgres + Redis backend.
          </p>
        </div>
        <p className="relative text-[12px] text-white/40">Demo workspace · not for production data</p>
      </div>

      <div className="flex items-center justify-center px-5 py-10">
        <div className="w-full max-w-[380px]">{children}</div>
      </div>
    </div>
  );
}
