import { type NextRequest, NextResponse } from "next/server";
import { eq, or, isNull, desc } from "drizzle-orm";
import { db, templatesTable } from "@workspace/db";
import { getAuthUser } from "@/lib/auth-server";
import { z } from "zod";

const CreateTemplateBodySchema = z.object({
  name: z.string().min(1).max(60),
  description: z.string().nullish(),
  category: z.enum(["capture", "plan", "reflect", "create", "mine"]),
  content: z.record(z.unknown()),
});

export async function GET(request: NextRequest) {
  const { user } = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const templates = await db
    .select()
    .from(templatesTable)
    .where(or(eq(templatesTable.isPreset, true), eq(templatesTable.userId, user.id)))
    .orderBy(desc(templatesTable.createdAt));

  return NextResponse.json(templates);
}

export async function POST(request: NextRequest) {
  const { user } = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = CreateTemplateBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const { name, description, category, content } = parsed.data;

  const [created] = await db
    .insert(templatesTable)
    .values({
      userId: user.id,
      name,
      description: description ?? null,
      category,
      content,
      isPreset: false,
    })
    .returning();

  return NextResponse.json(created, { status: 201 });
}
