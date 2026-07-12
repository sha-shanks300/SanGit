import { createClient } from "@/lib/supabase/client";

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = ["image/png", "image/jpeg", "image/webp"];

/**
 * Direct browser upload to the public `public-images` bucket (storage RLS
 * scopes writes to the caller's {user_id}/ folder — nothing proxies through
 * Vercel). Filenames are timestamped, never overwritten: the bucket is public
 * and CDN-cached, so a replaced image gets a fresh URL and the old file is
 * removed best-effort.
 *
 * Returns the public URL to store on the profile/project row.
 */
export async function uploadPublicImage(
  kind: "avatar" | "banner" | "artwork",
  file: File,
  opts: { projectId?: string; previousUrl?: string | null } = {}
): Promise<string> {
  if (!ALLOWED.includes(file.type)) {
    throw new Error("Use a PNG, JPEG, or WebP image.");
  }
  if (file.size > MAX_BYTES) {
    throw new Error("Image must be under 5 MB.");
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");

  const ext =
    file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const path =
    kind === "artwork"
      ? `${user.id}/artwork/${opts.projectId ?? "project"}-${Date.now()}.${ext}`
      : `${user.id}/${kind}-${Date.now()}.${ext}`;

  const { error } = await supabase.storage
    .from("public-images")
    .upload(path, file, { contentType: file.type });
  if (error) throw new Error(error.message);

  if (opts.previousUrl) {
    const marker = "/object/public/public-images/";
    const i = opts.previousUrl.indexOf(marker);
    if (i !== -1) {
      const oldPath = decodeURIComponent(opts.previousUrl.slice(i + marker.length));
      if (oldPath.startsWith(`${user.id}/`)) {
        void supabase.storage.from("public-images").remove([oldPath]);
      }
    }
  }

  return supabase.storage.from("public-images").getPublicUrl(path).data.publicUrl;
}
