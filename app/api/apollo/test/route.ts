import { NextResponse } from "next/server";
import { testApolloSearch } from "../../../../lib/agent/tools";

export async function GET() {
  const result = await testApolloSearch();
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
