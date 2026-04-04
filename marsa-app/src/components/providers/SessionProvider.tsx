"use client";

import { SessionProvider as NextAuthSessionProvider } from "next-auth/react";
import { LanguageProvider } from "@/contexts/LanguageContext";

export default function SessionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <NextAuthSessionProvider>
      <LanguageProvider>{children}</LanguageProvider>
    </NextAuthSessionProvider>
  );
}
