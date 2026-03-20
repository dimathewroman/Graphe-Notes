import { type NextRequest, NextResponse } from "next/server";
import { GetCurrentAuthUserResponse } from "@workspace/api-zod";
import { getAuthUser } from "@/lib/auth-server";

export async function GET(request: NextRequest) {
  const { user } = await getAuthUser(request);
  return NextResponse.json(GetCurrentAuthUserResponse.parse({ user }));
}
