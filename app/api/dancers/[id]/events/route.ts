import { NextRequest, NextResponse } from "next/server";
import { getSql } from "@/lib/database";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const sql = getSql();

    const events = await sql`
      SELECT 
        e.name as event_name,
        e.year,
        e.region,
        p.performance_type,
        p.mastery_level,
        p.entry_type,
        p.item_number,
        r.medal_awarded,
        r.final_score,
        r.ranking
      FROM performances p
      JOIN events e ON p.event_id = e.id
      LEFT JOIN rankings r ON p.id = r.performance_id
      WHERE p.dancer_id = ${id}
      ORDER BY e.year DESC, e.name ASC
    `;

    return NextResponse.json(events);
  } catch (error) {
    console.error("Error fetching dancer events:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

