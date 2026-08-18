import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/queries/profiles.server";
import { CreatePostForm } from "@/components/posts/create-post-form";

export default async function CreatePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/signup?next=%2Fcreate");

  const profile = await getCurrentProfile();

  return <CreatePostForm userId={user.id} defaultCity={profile?.city ?? null} />;
}
