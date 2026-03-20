import { type NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { GetTagsResponse } from "@workspace/api-zod";
import { getAuthUser } from "@/lib/auth-server";

export async function GET(request: NextRequest) {
  const { user } = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const result = await db.execute(
    sql`SELECT DISTINCT unnest(tags) as tag FROM notes WHERE user_id = ${user.id} ORDER BY tag`,
  );
  const tags = result.rows
    .map((row: Record<string, unknown>) => row.tag as string)
    .filter(Boolean);

  return NextResponse.json(GetTagsResponse.parse(tags));
}
