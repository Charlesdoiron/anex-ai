"use client";

import { useSession, signOut } from "@/app/lib/auth-client";
import Link from "next/link";
import { useState, useRef, useEffect } from "react";

export function UserMenu() {
  const { data: session, isPending } = useSession();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleSignOut() {
    await signOut();
    window.location.href = "/";
  }

  if (isPending) {
    return (
      <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse" />
    );
  }

  if (!session) {
    return (
      <div className="flex gap-2">
        <Link
          href="/login"
          className="underline underline-offset-4 px-4 py-2 text-sm font-medium  text-black  transition-colors"
        >
          Connexion
        </Link>
        <Link
          href="/signup"
          className="underline underline-offset-4 px-4 py-2 text-sm font-medium text-black  transition-colors"
        >
          Inscription
        </Link>
      </div>
    );
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2  transition-colors"
      >
        <div className="w-8 h-8 rounded-full bg-gray-800 dark:bg-gray-600 flex items-center justify-center text-white font-medium">
          {session.user.name?.charAt(0).toUpperCase() || "U"}
        </div>
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300 hidden sm:block">
          {session.user.name || session.user.email}
        </span>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-[#40414f]  shadow-lg dark:shadow-xl border border-gray-300 dark:border-gray-700 z-50">
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {session.user.name}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
              {session.user.email}
            </p>
          </div>
          <button
            onClick={handleSignOut}
            className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#343541] transition-colors rounded-b-lg"
          >
            Sign Out
          </button>
        </div>
      )}
    </div>
  );
}
