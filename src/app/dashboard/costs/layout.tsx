import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Header } from "@/components/layout/header";
import { dbService } from "@/lib/db/service";

export default async function CostsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get("session_id")?.value;

  if (!sessionId) redirect("/login");

  const session = await dbService.getSession(sessionId);
  if (!session) redirect("/login");

  const user = await dbService.getUserById(session.userId);
  if (!user) redirect("/login");

  return (
    <>
      <Header userEmail={user.email} />
      <main className="min-h-screen bg-gray-50 pb-12 pt-24">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">{children}</div>
      </main>
    </>
  );
}