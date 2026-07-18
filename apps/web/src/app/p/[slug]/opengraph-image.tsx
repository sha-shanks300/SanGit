import { ImageResponse } from "next/og";
import { createClient } from "@/lib/supabase/server";
import { getPublicProject, ogSafeImage } from "@/lib/public-project";
import { artworkFallback } from "@/lib/utils";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Listen on SanGit";

/**
 * Branded unfurl card for a shown project: dark canvas, artwork square,
 * title + producer + version count, wordmark. Crawlers are anonymous, so
 * RLS only resolves public projects — private ones get the generic card.
 */
export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await getPublicProject(slug);
  const project = data?.project.is_public ? data.project : null;
  const producer = data?.profile?.display_name || data?.profile?.username;
  const artworkUrl = ogSafeImage(project?.artwork_url ?? null);

  let versionCount = 0;
  if (project) {
    const supabase = await createClient();
    const { count } = await supabase
      .from("versions")
      .select("id", { count: "exact", head: true })
      .eq("project_id", project.id);
    versionCount = count ?? 0;
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: "#181818",
          color: "#ffffff",
          fontFamily: "sans-serif",
        }}
      >
        {/* artwork square */}
        <div
          style={{
            width: 630,
            height: 630,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            background: project ? artworkFallback(project.id) : "#202020",
            borderRight: "1px solid #303030",
          }}
        >
          {artworkUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- satori element, not DOM
            <img
              src={artworkUrl}
              alt=""
              width={630}
              height={630}
              style={{ objectFit: "cover", width: 630, height: 630 }}
            />
          ) : (
            <div style={{ display: "flex", fontSize: 220, color: "#8f8f8f" }}>
              {(project?.title ?? "S").slice(0, 1).toUpperCase()}
            </div>
          )}
        </div>

        {/* text column */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            padding: "0 56px",
            flexGrow: 1,
            minWidth: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div
              style={{
                display: "flex",
                width: 14,
                height: 14,
                borderRadius: 999,
                background: "#da291c",
              }}
            />
            <div
              style={{
                display: "flex",
                fontSize: 28,
                letterSpacing: 6,
                color: "#8f8f8f",
              }}
            >
              SANGIT
            </div>
          </div>
          <div
            style={{
              display: "flex",
              marginTop: 28,
              fontSize: 64,
              lineHeight: 1.1,
              color: "#ffffff",
            }}
          >
            {project?.title ?? "Listen on SanGit"}
          </div>
          {producer && (
            <div
              style={{
                display: "flex",
                marginTop: 18,
                fontSize: 34,
                color: "#969696",
              }}
            >
              by {producer}
            </div>
          )}
          {project && versionCount > 0 && (
            <div
              style={{
                display: "flex",
                marginTop: 40,
                fontSize: 26,
                color: "#666666",
              }}
            >
              {versionCount} version{versionCount === 1 ? "" : "s"} · music in
              progress
            </div>
          )}
        </div>
      </div>
    ),
    size
  );
}
