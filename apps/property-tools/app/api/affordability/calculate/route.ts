import { NextResponse } from "next/server";
import { calculateAffordability } from "@/lib/affordability/engine";
import { persistAffordabilitySession } from "@/lib/affordability/session-store";
import type { AffordabilityInput } from "@/lib/affordability/types";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Partial<AffordabilityInput>;

    if (!body.sessionId) {
      return NextResponse.json({ success: false, error: "Missing sessionId" }, { status: 400 });
    }

    if (!body.annualIncome || body.annualIncome <= 0) {
      return NextResponse.json(
        { success: false, error: "Annual income is required" },
        { status: 400 }
      );
    }

    const input: AffordabilityInput = {
      sessionId: body.sessionId,
      annualIncome: Number(body.annualIncome || 0),
      monthlyDebts: Number(body.monthlyDebts || 0),
      downPayment: Number(body.downPayment || 0),
      downPaymentMode: body.downPaymentMode || "amount",
      downPaymentPercent:
        typeof body.downPaymentPercent === "number" ? body.downPaymentPercent : undefined,
      interestRate: Number(body.interestRate || 6.75),
      loanTermYears: Number(body.loanTermYears || 30),
      propertyTaxRate: Number(body.propertyTaxRate || 0.0125),
      annualHomeInsurance: Number(body.annualHomeInsurance || 1800),
      monthlyHoa: Number(body.monthlyHoa || 0),
      dtiFrontLimit: typeof body.dtiFrontLimit === "number" ? body.dtiFrontLimit : undefined,
      dtiBackLimit: typeof body.dtiBackLimit === "number" ? body.dtiBackLimit : undefined,
      loanProgram: body.loanProgram || "conventional",
      creditScore: typeof body.creditScore === "number" ? body.creditScore : undefined,
      zip: body.zip,
      firstTimeBuyer: Boolean(body.firstTimeBuyer),
    };

    const result = calculateAffordability(input);

    await persistAffordabilitySession(
      body.sessionId,
      {
        annualIncome: input.annualIncome,
        monthlyDebts: input.monthlyDebts,
        downPayment: input.downPayment,
        downPaymentMode: input.downPaymentMode,
        downPaymentPercent: input.downPaymentPercent,
        interestRate: input.interestRate,
        loanTermYears: input.loanTermYears,
        propertyTaxRate: input.propertyTaxRate,
        annualHomeInsurance: input.annualHomeInsurance,
        monthlyHoa: input.monthlyHoa,
        dtiFrontLimit: input.dtiFrontLimit,
        dtiBackLimit: input.dtiBackLimit,
        loanProgram: input.loanProgram,
        creditScore: input.creditScore,
        zip: input.zip,
        firstTimeBuyer: input.firstTimeBuyer,
      },
      result
    );

    return NextResponse.json({
      success: true,
      sessionId: input.sessionId,
      result,
    });
  } catch (error) {
    console.error("affordability calculate error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to calculate affordability",
      },
      { status: 500 }
    );
  }
}
