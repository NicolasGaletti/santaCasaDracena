import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Atkinson_Hyperlegible } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

const atkinson = Atkinson_Hyperlegible({
  variable: "--font-atkinson",
  subsets: ["latin"],
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: "Prontuário Santa Casa",
  description: "Prontuário eletrônico de internação da Santa Casa de Dracena",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" className={`${atkinson.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
