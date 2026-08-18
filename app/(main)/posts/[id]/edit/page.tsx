import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPost } from "@/lib/queries/posts";
import { getRegions } from "@/lib/queries/regions";
import { PostEditForm } from "@/components/posts/post-edit-form";

export default async function PostEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/signup?next=${encodeURIComponent(`/posts/${id}/edit`)}`);

  const post = await getPost(supabase, id);
  if (!post) notFound();

  // public_posts exposes your own author_id even on anonymous posts, so
  // this check works without leaking anyone else's.
  if (post.author_id !== user.id) redirect(`/posts/${id}`);

  const regions = await getRegions(supabase);

  return <PostEditForm post={post} regions={regions} />;
}
