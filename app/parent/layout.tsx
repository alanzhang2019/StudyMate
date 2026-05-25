import { redirect } from "next/navigation";
import { auth } from "@/auth";

export default async function ParentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  
  if (!session) {
    redirect("/auth/login");
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm px-6 py-4 flex justify-between items-center">
        <h1 className="text-xl font-bold text-gray-800">Parent Dashboard</h1>
        <div className="flex gap-4">
          <a href="/select-profile" className="text-blue-600 hover:underline">Switch Profile</a>
        </div>
      </nav>
      <main className="p-6 max-w-6xl mx-auto">
        {children}
      </main>
    </div>
  );
}
