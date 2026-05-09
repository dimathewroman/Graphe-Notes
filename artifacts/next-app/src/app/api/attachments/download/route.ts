import { type NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import * as Sentry from "@sentry/nextjs";

/**
 * GET /api/attachments/download?path=<storagePath>&format=avif|jpeg
 *
 * format=avif (default) — streams the stored AVIF directly; no conversion.
 * format=jpeg           — converts the AVIF to JPEG via sharp for maximum compatibility.
 */
export async function GET(request: NextRequest) {
  const { user } = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const storagePath = request.nextUrl.searchParams.get("path");
  if (!storagePath) return NextResponse.json({ error: "path is required" }, { status: 400 });

  const format = request.nextUrl.searchParams.get("format") === "jpeg" ? "jpeg" : "avif";

  // Ensure the path belongs to the authenticated user (first segment is user ID)
  const [pathUserId] = storagePath.split("/");
  if (pathUserId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    // Fetch a short-lived signed URL then download the raw bytes
    const { data: signedData, error: signError } = await supabaseAdmin.storage
      .from("note-attachments")
      .createSignedUrl(storagePath, 60);

    if (signError || !signedData?.signedUrl) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    const response = await fetch(signedData.signedUrl);
    if (!response.ok) {
      return NextResponse.json({ error: "Failed to fetch file" }, { status: 502 });
    }

    // Derive a human-readable filename from the storage path
    const rawName = storagePath.split("/").pop() ?? "image";
    // Strip the UUID prefix (36 chars + dash) if present
    const withoutUuid = rawName.replace(/^[0-9a-f-]{37}/, "");
    const baseName = withoutUuid.replace(/\.avif$/i, "") || "image";

    if (format === "avif") {
      const avifBuffer = Buffer.from(await response.arrayBuffer());
      return new NextResponse(new Uint8Array(avifBuffer), {
        status: 200,
        headers: {
          "Content-Type": "image/avif",
          "Content-Disposition": `attachment; filename="${baseName}.avif"`,
          "Content-Length": String(avifBuffer.length),
          "Cache-Control": "private, no-store",
        },
      });
    }

    // JPEG: convert via sharp
    const inputBuffer = Buffer.from(await response.arrayBuffer());
    const sharp = (await import("sharp")).default;
    const jpegBuffer = await sharp(inputBuffer).jpeg({ quality: 90 }).toBuffer();

    return new NextResponse(new Uint8Array(jpegBuffer), {
      status: 200,
      headers: {
        "Content-Type": "image/jpeg",
        "Content-Disposition": `attachment; filename="${baseName}.jpg"`,
        "Content-Length": String(jpegBuffer.length),
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
