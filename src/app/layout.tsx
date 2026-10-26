import type { Metadata } from "next";
import { Albert_Sans } from "next/font/google";
import "./globals.css";

const albertSans = Albert_Sans({
  variable: "--font-albert-sans",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Locarent",
    template: "%s · Locarent",
  },
  description:
    "Logiciel de gestion pour les agences de location de véhicules en Polynésie française.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" className={`${albertSans.variable} h-full`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
