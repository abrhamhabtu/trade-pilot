"use client";
import { AppShell } from "@/components/app/AppShell";
import { SessionPlanner } from "@/components/routine/SessionPlanner";
export default function SessionPage() {
  return (
    <AppShell showAccountSelector={false}>
      <SessionPlanner />
    </AppShell>
  );
}
