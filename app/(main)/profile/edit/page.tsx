import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/queries/profiles.server";
import { getRegions } from "@/lib/queries/regions";
import { ProfileEditForm } from "@/components/profile/profile-edit-form";

export default async function ProfileEditPage() {
  const supabase = await createClient();
  const profile = await getCurrentProfile();

  if (!profile) redirect("/signup?next=%2Fprofile%2Fedit");

  const regions = await getRegions(supabase);

  return <ProfileEditForm profile={profile} regions={regions} />;
}
