import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { legs, metrics, cdiRate, daysToExpiry } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const legsDescription = Array.isArray(legs)
      ? legs
          .map((l: any) => `${l.side === "buy" ? "Compra" : "Venda"} ${String(l.option_type).toUpperCase()} ${l.asset} Strike ${l.strike} @ ${l.price} x${l.quantity}`)
          .join("\n")
      : "Sem pernas";

    const prompt = `Analise a estrutura abaixo e retorne uma avaliação curta e objetiva para decisão rápida.

PERNAS:
${legsDescription}

MÉTRICAS:
- Ganho Máximo: ${metrics.maxGain === "Ilimitado" ? "Ilimitado" : "R$ " + metrics.maxGain}
- Perda Máxima: ${metrics.maxLoss === "Ilimitado" ? "Ilimitado" : "R$ " + metrics.maxLoss}
- Breakevens: ${metrics.breakevens?.length ? metrics.breakevens.map((b: number) => "R$ " + b.toFixed(2)).join(", ") : "N/A"}
- Custo Líquido: R$ ${metrics.netCost}
${cdiRate ? `- CDI: ${cdiRate}% a.a.` : ""}
${daysToExpiry ? `- Dias até vencimento: ${daysToExpiry}` : ""}

Retorne com foco em decisão: vale a pena montar a estrutura ou não, com justificativa resumida.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content:
              "Você é analista de opções do mercado brasileiro. Seja extremamente objetivo. Evite texto longo. Entregue veredito claro para ação.",
          },
          { role: "user", content: prompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "emit_analysis",
              description: "Retorna análise objetiva para decisão da estrutura",
              parameters: {
                type: "object",
                properties: {
                  verdict: { type: "string", enum: ["vale_a_pena", "nao_vale_a_pena", "depende"] },
                  structure_type: { type: "string" },
                  market_scenario: { type: "string" },
                  risk_return: { type: "string" },
                  cdi_vs_structure: { type: "string" },
                  summary: { type: "string" },
                },
                required: ["verdict", "structure_type", "market_scenario", "risk_return", "summary"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "emit_analysis" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error("AI gateway error");
    }

    const result = await response.json();
    const toolArgs = result.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;

    if (!toolArgs) {
      const fallback = result.choices?.[0]?.message?.content || "Sem sugestão disponível.";
      return new Response(JSON.stringify({ suggestion: fallback }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const parsed = JSON.parse(toolArgs);
    const verdictLabel =
      parsed.verdict === "vale_a_pena"
        ? "✅ Vale a pena"
        : parsed.verdict === "nao_vale_a_pena"
          ? "⛔ Não vale a pena"
          : "⚖️ Depende";

    const suggestion = [
      `${verdictLabel}`,
      `Estrutura: ${parsed.structure_type}`,
      `Cenário: ${parsed.market_scenario}`,
      `Risco/Retorno: ${parsed.risk_return}`,
      parsed.cdi_vs_structure ? `CDI vs Estrutura: ${parsed.cdi_vs_structure}` : null,
      `Resumo: ${parsed.summary}`,
    ]
      .filter(Boolean)
      .join("\n");

    return new Response(JSON.stringify({ suggestion }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-structure error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

