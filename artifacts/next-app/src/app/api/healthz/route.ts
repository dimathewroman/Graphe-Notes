import { NextResponse } from "next/server";
import { HealthCheckResponse } from "@workspace/api-zod";

export function GET() {
  return NextResponse.json(HealthCheckResponse.parse({ status: "ok" }));
}
