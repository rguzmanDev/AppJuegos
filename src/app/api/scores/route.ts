import { NextRequest, NextResponse } from "next/server";
import { saveScore, getTop10 } from "@/lib/db";
import type { GameId } from "@/lib/types";

export async function GET(req: NextRequest) {
  const game = req.nextUrl.searchParams.get("game") as GameId | null;
  if (!game) return NextResponse.json({ error: "game param required" }, { status: 400 });
  const scores = getTop10(game);
  return NextResponse.json(scores);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { game, nickname, score } = body;
  if (!game || !nickname || score == null) {
    return NextResponse.json({ error: "game, nickname, score required" }, { status: 400 });
  }
  saveScore({ game, nickname, score });
  return NextResponse.json({ ok: true });
}
