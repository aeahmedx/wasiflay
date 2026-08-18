import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/queries/profiles.server";
import { getRegions } from "@/lib/queries/regions";
import { CreatePostForm } from "@/components/posts/create-post-form";

export default async function CreatePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/signup?next=%2Fcreate");

  const [profile, regions] = await Promise.all([
    getCurrentProfile(),
    getRegions(supabase),
  ]);

  return (
    <CreatePostForm
      userId={user.id}
      defaultRegion={profile?.region ?? regions[0]?.slug ?? "other"}
      regions={regions}
    />
  );
}
