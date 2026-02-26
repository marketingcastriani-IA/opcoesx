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

    const legsDescription = legs.map((l: any) => 
      `${l.side === 'buy' ? 'Compra' : 'Venda'} ${l.option_type.toUpperCase()} ${l.asset} Strike ${l.strike} @ ${l.price} x${l.quantity}`
    ).join('\n');

    const prompt = `Analise esta estrutura de opções do mercado brasileiro e dê sua recomendação:

PERNAS:
${legsDescription}

MÉTRICAS:
- Ganho Máximo: ${metrics.maxGain === 'Ilimitado' ? 'Ilimitado' : 'R$ ' + metrics.maxGain}
- Perda Máxima: ${metrics.maxLoss === 'Ilimitado' ? 'Ilimitado' : 'R$ ' + metrics.maxLoss}
- Breakevens: ${metrics.breakevens.length > 0 ? metrics.breakevens.map((b: number) => 'R$ ' + b.toFixed(2)).join(', ') : 'N/A'}
- Custo Líquido: R$ ${metrics.netCost}
${cdiRate ? `- CDI: ${cdiRate}% a.a.` : ''}
${daysToExpiry ? `- Dias até vencimento: ${daysToExpiry}` : ''}

Responda em português brasileiro. Seja direto e prático. Inclua:
1. Tipo da estrutura identificada (trava, borboleta, condor, etc.)
2. Cenário ideal de mercado para esta operação
3. Relação risco/retorno
4. Se vale a pena montar ou não e por quê
5. Comparação com CDI se os dados estiverem disponíveis`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "Você é um analista de derivativos especializado no mercado brasileiro de opções. Dê análises claras, objetivas e educativas." },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error("AI gateway error");
    }

    const result = await response.json();
    const suggestion = result.choices?.[0]?.message?.content || "Sem sugestão disponível.";

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
