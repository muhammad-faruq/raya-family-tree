import { getFamilyData, replaceFamilyData, type FamilyDatum } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const data = getFamilyData();
    return NextResponse.json(data);
  } catch (err) {
    console.error("Failed to load family data:", err);
    return NextResponse.json(
      { error: "Failed to load family data" },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as FamilyDatum[];
    if (!Array.isArray(body)) {
      return NextResponse.json(
        { error: "Body must be an array of family data" },
        { status: 400 }
      );
    }
    replaceFamilyData(body);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Failed to save family data:", err);
    return NextResponse.json(
      { error: "Failed to save family data" },
      { status: 500 }
    );
  }
}
