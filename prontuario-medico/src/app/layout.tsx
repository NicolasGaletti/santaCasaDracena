import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Inter, Poppins } from "next/font/google";
import "./globals.css";
import { SerwistProvider } from "@serwist/turbopack/react";
import { Toaster } from "@/components/ui/sonner";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Prontuário Santa Casa",
  description: "Prontuário eletrônico de internação da Santa Casa de Dracena",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${poppins.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <SerwistProvider swUrl="/sw.js" cacheOnNavigation={false} reloadOnOnline={false}>
          {children}
        </SerwistProvider>
        <Toaster position="top-center" />
      </body>
    </html>
  );
}
