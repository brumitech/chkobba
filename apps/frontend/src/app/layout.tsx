// frontend/src/app/layout.tsx
import { ToastProvider } from "../ui/toast";
import "./globals.css";

export const metadata = {
  title: "Chkobba Game",
  description: "Traditional North African card game",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gradient-to-b from-red-900 to-red-700">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}