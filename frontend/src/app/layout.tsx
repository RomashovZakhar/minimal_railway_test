import type { Metadata } from "next";
import { Inter as FontSans } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/auth";
import { Toaster } from "@/components/ui/sonner";
import { SettingsDialog } from "@/components/settings/settings-dialog";
import { cn } from "@/lib/utils";

const fontSans = FontSans({
  subsets: ["latin"],
  display: 'swap',
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "Documentea",
  description: "Управление задачами и документами",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body
        className={cn(
          "min-h-screen bg-background font-sans antialiased",
          fontSans.variable
        )}
      >
        <AuthProvider>
          {children}
          <SettingsDialog />
          <Toaster />
        </AuthProvider>
      </body>
    </html>
  );
}
