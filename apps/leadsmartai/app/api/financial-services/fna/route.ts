import { NextResponse } from "next/server";
import { fnaReport, type FnaPromptInput } from "@/lib/ai/prompts";
import { generateAIResponse } from "@/lib/ai/aiService";
import { supabaseServerClient } from "@/lib/supabaseServerClient";
import { computeFna } from "@/lib/financial-services/fna-calc";

export const runtime = "nodejs";

type FnaBody = {
  clientName?: string;
  age?: number;
  spouseAge?: number;
  annualIncome?: number;
  spouseIncome?: number;
  dependents?: number;
  outstandingDebts?: number;
  mortgageBalance?: number;
  currentSavings?: number;
  current401k?: number;
  retirementAge?: number;
  monthlyExpenses?: number;
  existingCoverage?: number;
  riskTolerance?: "conservative" | "moderate" | "aggressive";
  goals?: string[];
  advisorName?: string;
  agencyName?: string;
  language?: string;
};

function num(v: unknown): number | undefined {
  if (typeof v !== "number" || !Number.isFinite(v)) return undefined;
  return v;
}

export async function POST(req: Request) {
  try {
    const supabase = supabaseServerClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
    }
    const userId = userData.user.id;

    const body = (await req.json().catch(() => ({}))) as FnaBody;

    const clientName = typeof body.clientName === "string" ? body.clientName.trim() : "";
    if (!clientName) {
      return NextResponse.json(
        { ok: false, error: "clientName is required." },
        { status: 400 }
      );
    }

    const calc = computeFna({
      age: num(body.age),
      annualIncome: num(body.annualIncome),
      spouseIncome: num(body.spouseIncome),
      dependents: num(body.dependents),
      outstandingDebts: num(body.outstandingDebts),
      mortgageBalance: num(body.mortgageBalance),
      currentSavings: num(body.currentSavings),
      current401k: num(body.current401k),
      retirementAge: num(body.retirementAge),
      monthlyExpenses: num(body.monthlyExpenses),
      existingCoverage: num(body.existingCoverage),
    });

    const promptInput: FnaPromptInput = {
      clientName,
      age: num(body.age),
      spouseAge: num(body.spouseAge),
      annualIncome: num(body.annualIncome),
      spouseIncome: num(body.spouseIncome),
      dependents: num(body.dependents),
      outstandingDebts: num(body.outstandingDebts),
      mortgageBalance: num(body.mortgageBalance),
      currentSavings: num(body.currentSavings),
      current401k: num(body.current401k),
      retirementAge: num(body.retirementAge),
      monthlyExpenses: num(body.monthlyExpenses),
      existingCoverage: num(body.existingCoverage),
      riskTolerance: body.riskTolerance ?? null,
      goals: Array.isArray(body.goals)
        ? body.goals.filter((g) => typeof g === "string")
        : null,
      computed: {
        incomeReplacementNeed: calc.incomeReplacementNeed,
        dimeNumber: calc.dimeNumber,
        coverageGap: calc.coverageGap,
        retirementShortfall: calc.retirementShortfall,
        recommendedCoverage: calc.recommendedCoverage,
      },
    };

    const prompt = fnaReport(promptInput, {
      language: typeof body.language === "string" ? body.language : undefined,
      advisorName: typeof body.advisorName === "string" ? body.advisorName : undefined,
      agencyName: typeof body.agencyName === "string" ? body.agencyName : undefined,
    });

    const ai = await generateAIResponse({
      prompt,
      userId,
      tool: "financial_services_fna",
      temperature: 0.5,
      useCache: true,
    });

    return NextResponse.json({
      ok: true,
      report: ai.text,
      cached: ai.cached,
      tokensUsed: ai.tokensUsed,
      calculations: calc,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
