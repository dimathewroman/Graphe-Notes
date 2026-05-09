import { type NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import * as Sentry from "@sentry/nextjs";

/**
 * GET /api/attachments/download?path=<storagePath>
 *
 * Fetches an AVIF image from Supabase Storage, converts it to JPEG via sharp,
 * and serves it with a Content-Disposition: attachment header so the browser
 * saves it as a .jpg file instead of displaying the AVIF inline.
 */
export async function GET(request: NextRequest) {
  const { user } = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const storagePath = request.nextUrl.searchParams.get("path");
  if (!storagePath) return NextResponse.json({ error: "path is required" }, { status: 400 });

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

    const inputBuffer = Buffer.from(await response.arrayBuffer());
    const sharp = (await import("sharp")).default;
    const jpegBuffer = await sharp(inputBuffer).jpeg({ quality: 90 }).toBuffer();

    // Derive a human-readable filename from the storage path
    const rawName = storagePath.split("/").pop() ?? "image";
    // Strip the UUID prefix (36 chars + dash) if present
    const withoutUuid = rawName.replace(/^[0-9a-f-]{37}/, "");
    // Strip .avif and append .jpg
    const baseName = withoutUuid.replace(/\.avif$/i, "") || "image";
    const downloadName = `${baseName}.jpg`;

    // Uint8Array satisfies BodyInit (ArrayBufferView); Buffer alone may not in strict TS
    return new NextResponse(new Uint8Array(jpegBuffer), {
      status: 200,
      headers: {
        "Content-Type": "image/jpeg",
        "Content-Disposition": `attachment; filename="${downloadName}"`,
        "Content-Length": String(jpegBuffer.length),
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
