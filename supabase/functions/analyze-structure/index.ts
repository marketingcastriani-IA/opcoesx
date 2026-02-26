import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const monthMapCalls = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"];
const monthMapPuts = ["M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X"];

const getExpiryMonth = (asset: string) => {
  const letter = asset?.[4]?.toUpperCase() || "";
  const callIdx = monthMapCalls.indexOf(letter);
  if (callIdx >= 0) return callIdx + 1;
  const putIdx = monthMapPuts.indexOf(letter);
  if (putIdx >= 0) return putIdx + 1;
  return null;
};

const getUnderlyingRoot = (asset: string) => {
  const match = asset?.toUpperCase().match(/[A-Z]{4}/);
  return match ? match[0] : asset?.slice(0, 4)?.toUpperCase();
};

const detectCollar = (legs: any[]) => {
  const stock = legs.find((l) => l.option_type === "stock" && l.side === "buy");
  const put = legs.find((l) => l.option_type === "put" && l.side === "buy");
  const call = legs.find((l) => l.option_type === "call" && l.side === "sell");
  if (!stock || !put || !call) return false;
  const root = getUnderlyingRoot(stock.asset);
  const putRoot = getUnderlyingRoot(put.asset);
  const callRoot = getUnderlyingRoot(call.asset);
  const putMonth = getExpiryMonth(put.asset);
  const callMonth = getExpiryMonth(call.asset);
  return root && root === putRoot && root === callRoot && putMonth && callMonth && putMonth === callMonth;
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

    const collarDetected = Array.isArray(legs) ? detectCollar(legs) : false;
    const collarLabel = "Estratégia: Collar (Financiamento com Proteção)";

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
${collarDetected ? `\nCLASSIFICAÇÃO AUTOMÁTICA: ${collarLabel}` : ""}

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

    const structureLabel = collarDetected ? collarLabel : `Estrutura: ${parsed.structure_type}`;

    const suggestion = [
      `${verdictLabel}`,
      structureLabel,
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
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
