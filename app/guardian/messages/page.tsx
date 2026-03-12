import { GuardianNav } from "@/components/guardian/GuardianNav";
import { MessagingCenter } from "@/components/messaging/MessagingCenter";

export default function GuardianMessagesPage() {
  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-50">
      <div className="mx-auto max-w-6xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Messages</h1>
          <p className="mt-1 text-sm text-slate-400">
            Contact your child&apos;s teacher and review recent conversation history.
          </p>
        </div>

        <GuardianNav />
        <MessagingCenter
          role="guardian"
          emptyState="No messages yet. You can message your child's teacher from here."
        />
      </div>
    </main>
  );
}
