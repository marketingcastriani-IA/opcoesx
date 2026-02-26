import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type RawLeg = {
  side?: string;
  option_type?: string;
  asset?: string;
  strike?: number | string;
  price?: number | string;
  quantity?: number | string;
};

const toNumber = (value: unknown): number => {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const normalized = value.replace(/R\$|BRL|\s/g, "").replace(/\./g, "").replace(",", ".");
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

const normalizeLegs = (legs: RawLeg[] | undefined) => {
  if (!Array.isArray(legs)) return [];

  return legs
    .map((leg) => {
      const side = leg.side === "buy" || leg.side === "sell" ? leg.side : null;
      const optionType = leg.option_type === "call" || leg.option_type === "put" || leg.option_type === "stock"
        ? leg.option_type : null;
      const asset = typeof leg.asset === "string" ? leg.asset.trim().toUpperCase() : "";
      const strike = toNumber(leg.strike);
      const price = toNumber(leg.price);
      const quantity = Math.max(1, Math.round(toNumber(leg.quantity) || 1));

      if (!side || !optionType || !asset || strike <= 0) return null;
      // For stock legs, price can be 0 (it's the spot purchase, strike = purchase price)
      if (optionType !== "stock" && price <= 0) return null;

      return {
        side,
        option_type: optionType,
        asset,
        strike: Number(strike.toFixed(2)),
        price: Number(price.toFixed(2)),
        quantity,
      };
    })
    .filter(Boolean);
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { imageDataUrl, image } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const resolvedImage = typeof imageDataUrl === "string" && imageDataUrl.startsWith("data:image/")
      ? imageDataUrl
      : typeof image === "string"
        ? `data:image/png;base64,${image}`
        : null;

    if (!resolvedImage) {
      return new Response(JSON.stringify({ legs: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `Você é especialista em leitura de screenshots de plataformas brasileiras de opções (Clear, XP, BTG, Rico, Inter, etc).

OBJETIVO: Extrair TODAS as pernas da grade de ordens/book de ofertas. NÃO invente pernas. NÃO omita pernas.

REGRAS CRÍTICAS:
1. side: "buy" para Compra/C/+, "sell" para Venda/V/-
2. option_type: "call" para Call/C, "put" para Put/P, "stock" para ativo-objeto (quando o campo Call/Put mostra "-", "Ação", está vazio ou é o próprio ticker base como PETR4)
3. asset: ticker em maiúsculas (ex: PETR4, VALE3, PETRD325, etc)
4. strike: preço de exercício como número decimal. Para pernas "stock", use o preço unitário de compra/venda do ativo
5. price: prêmio da opção como número decimal. Para pernas "stock", use 0
6. quantity: quantidade inteira >= 1

DUPLA VERIFICAÇÃO: Conte quantas linhas a tabela da imagem possui. O número de pernas extraídas DEVE ser igual ao número de linhas. Se faltar alguma, revise.

ATENÇÃO ESPECIAL: Linhas sem indicação Call/Put (campo vazio, "-" ou mostrando o ativo base) são pernas de ATIVO-OBJETO (stock). NÃO as descarte.`,
          },
          {
            role: "user",
            content: [
              { type: "text", text: "Extraia TODAS as pernas da operação desta imagem. Cada linha da tabela é uma perna. Não omita nenhuma." },
              { type: "image_url", image_url: { url: resolvedImage } },
            ],
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_legs",
              description: "Extrai todas as pernas de opções/ações da imagem",
              parameters: {
                type: "object",
                properties: {
                  legs: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        side: { type: "string", enum: ["buy", "sell"] },
                        option_type: { type: "string", enum: ["call", "put", "stock"] },
                        asset: { type: "string" },
                        strike: { type: "number" },
                        price: { type: "number" },
                        quantity: { type: "number" },
                      },
                      required: ["side", "option_type", "asset", "strike", "price", "quantity"],
                      additionalProperties: false,
                    },
                  },
                  total_rows_in_image: {
                    type: "number",
                    description: "Número total de linhas/pernas visíveis na tabela da imagem para dupla verificação",
                  },
                },
                required: ["legs", "total_rows_in_image"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "extract_legs" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Try again later." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      throw new Error("AI gateway error");
    }

    const result = await response.json();
    const toolCallArgs = result.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    const parsedTool = toolCallArgs ? JSON.parse(toolCallArgs) : null;

    console.log("Extracted legs count:", parsedTool?.legs?.length, "Image rows:", parsedTool?.total_rows_in_image);

    const normalized = normalizeLegs(parsedTool?.legs);

    return new Response(JSON.stringify({ legs: normalized }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-options-image error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
