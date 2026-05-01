import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/users";
import SettingsForm from "./settings-form";

export default async function SettingsPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  const user = await getUser(userId);
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Anki bridge, study targets, voice preferences.
        </p>
      </div>
      <SettingsForm
        initial={{
          ankiFunnelUrl: user?.ankiFunnelUrl ?? "",
          ankiAuthKey: user?.ankiAuthKey ?? "",
          ankiMainDeckName: user?.ankiMainDeckName ?? "Default",
          ankiNoteType: user?.ankiNoteType ?? "Kotoba Mined",
          jlptTarget: user?.jlptTarget ?? "N2",
          dailyMinutesGoal: user?.dailyMinutesGoal ?? 45,
          voicevoxSpeakerId: user?.voicevoxSpeakerId ?? 3,
        }}
      />
    </div>
  );
}
