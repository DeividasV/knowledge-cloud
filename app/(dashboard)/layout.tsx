import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Sidebar } from "@/components/sidebar";
import { MobileNav } from "@/components/mobile-nav";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const userId = session.user.id!;

  const [categories, user] = await Promise.all([
    prisma.category.findMany({
      where: { channels: { some: { users: { some: { id: userId } } } } },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { selectedCategory: true },
    }),
  ]);

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <MobileNav
        categories={categories}
        selectedCategory={user?.selectedCategory ?? null}
      />
      <Sidebar
        user={session.user}
        categories={categories}
        selectedCategory={user?.selectedCategory ?? null}
      />
      <main className="flex-1 p-4 lg:p-8 overflow-auto">
        {children}
      </main>
    </div>
  );
}
