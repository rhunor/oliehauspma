// src/app/page.tsx
"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function HomePage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "loading") return; // Still loading

    if (!session) {
      // Not authenticated, redirect to login
      router.replace("/login");
      return;
    }

    // Authenticated, redirect based on role
    switch (session.user?.role) {
      case "super_admin":
        router.replace("/admin");
        break;
      case "project_manager":
        router.replace("/manager");
        break;
      case "client":
        router.replace("/client");
        break;
      default:
        router.replace("/login");
    }
  }, [session, status, router]);

  // Show loading state
  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50">
      <div className="text-center">
        <div className="w-16 h-16 bg-primary-500 rounded-xl flex items-center justify-center mx-auto mb-4">
          <span className="text-white font-bold text-2xl">O</span>
        </div>
        <h1 className="text-2xl font-serif font-bold text-gray-900 mb-2">
          OliveHaus PPMA
        </h1>
        <p className="text-neutral-600">
          {status === "loading" ? "Loading..." : "Redirecting..."}
        </p>
      </div>
    </div>
  );
}