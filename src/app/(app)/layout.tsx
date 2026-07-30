import { MobileNav, Sidebar } from "@/components/layout/sidebar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <Sidebar />
      <div className="lg:pl-60">
        {children}
      </div>
      <MobileNav />
    </div>
  );
}
