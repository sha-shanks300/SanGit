import { ImageResponse } from "next/og";
import { getPublicProfile, ogSafeImage } from "@/lib/public-project";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Producer profile on SanGit";

/** Branded unfurl card for a producer profile: avatar, name, @username,
 *  shown-project count. */
export default async function Image({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const data = await getPublicProfile(username);
  const profile = data?.profile ?? null;
  const avatarUrl = ogSafeImage(profile?.avatar_url ?? null);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          background: "#181818",
          color: "#ffffff",
          fontFamily: "sans-serif",
        }}
      >
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- satori element, not DOM
          <img
            src={avatarUrl}
            alt=""
            width={200}
            height={200}
            style={{
              width: 200,
              height: 200,
              borderRadius: 999,
              objectFit: "cover",
              border: "1px solid #3c3c3c",
            }}
          />
        ) : (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 200,
              height: 200,
              borderRadius: 999,
              background: "#303030",
              fontSize: 96,
              color: "#969696",
            }}
          >
            {(profile?.display_name || profile?.username || "S")
              .slice(0, 1)
              .toUpperCase()}
          </div>
        )}

        <div style={{ display: "flex", marginTop: 40, fontSize: 60 }}>
          {profile?.display_name || profile?.username || "SanGit"}
        </div>
        {profile && (
          <div
            style={{
              display: "flex",
              marginTop: 12,
              fontSize: 30,
              color: "#969696",
            }}
          >
            @{profile.username}
            {data && data.publicProjects > 0
              ? ` · ${data.publicProjects} project${data.publicProjects === 1 ? "" : "s"}`
              : ""}
          </div>
        )}

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginTop: 56,
          }}
        >
          <div
            style={{
              display: "flex",
              width: 12,
              height: 12,
              borderRadius: 999,
              background: "#da291c",
            }}
          />
          <div
            style={{
              display: "flex",
              fontSize: 24,
              letterSpacing: 5,
              color: "#8f8f8f",
            }}
          >
            SANGIT
          </div>
        </div>
      </div>
    ),
    size
  );
}
