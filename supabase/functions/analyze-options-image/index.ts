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

const normalizeSide = (value?: string, optionType?: string) => {
  const raw = typeof value === "string" ? value.trim().toUpperCase() : "";
  if (raw === "C" || raw === "COMPRA" || raw === "BUY" || raw === "B") return "buy";
  if (raw === "V" || raw === "VENDA" || raw === "SELL" || raw === "S") return "sell";
  if (optionType === "stock") return "buy";
  return null;
};

const normalizeOptionType = (value?: string, asset?: string) => {
  const raw = typeof value === "string" ? value.trim().toUpperCase() : "";
  
  if (raw === "CALL" || raw === "C") return "call";
  if (raw === "PUT" || raw === "P") return "put";
  if (raw === "STOCK" || raw === "AÇÃO" || raw === "ACAO" || raw === "ATIVO" || raw === "BASE" || raw === "-" || raw === "") {
    return "stock";
  }
  
  if ((!raw || raw === "-") && asset) {
    const assetUpper = asset.toUpperCase();
    if (assetUpper.length >= 7) {
      const monthLetter = assetUpper[4];
      if (/[A-L]/.test(monthLetter)) return "call";
      if (/[M-X]/.test(monthLetter)) return "put";
    }
    if (assetUpper.length <= 5) return "stock";
  }
  
  return null;
};

const validateAsset = (asset?: string): string | null => {
  if (!asset) return null;
  const cleaned = asset.trim().toUpperCase();
  if (/^[A-Z0-9]{4,7}$/.test(cleaned)) {
    return cleaned;
  }
  return null;
};

const normalizeLegs = (legs: RawLeg[] | undefined) => {
  if (!Array.isArray(legs)) return [];

  return legs
    .map((leg, idx) => {
      const asset = validateAsset(leg.asset);
      if (!asset) {
        console.warn(`Leg ${idx}: Asset inválido ou vazio:`, leg.asset);
        return null;
      }

      const optionType = normalizeOptionType(leg.option_type, asset);
      if (!optionType) {
        console.warn(`Leg ${idx}: Tipo de opção não reconhecido:`, leg.option_type);
        return null;
      }

      const side = normalizeSide(leg.side, optionType);
      if (!side) {
        console.warn(`Leg ${idx}: Lado (Compra/Venda) não reconhecido:`, leg.side);
        return null;
      }

      const strikeRaw = toNumber(leg.strike);
      const priceRaw = toNumber(leg.price);

      let strike = strikeRaw;
      let price = priceRaw;

      if (optionType === "stock") {
        // VALIDAÇÃO QUÍNTUPLA: Preço de Ativo com máxima prioridade
        let assetPrice = 0;

        // Tentativa 1: price > 0 (campo de preço do prêmio)
        if (priceRaw > 0) {
          console.log(`Leg ${idx}: Preço encontrado no campo PRICE: ${priceRaw}`);
          assetPrice = priceRaw;
        }
        // Tentativa 2: strike > 0 (campo de strike)
        else if (strikeRaw > 0) {
          console.log(`Leg ${idx}: Preço encontrado no campo STRIKE: ${strikeRaw}`);
          assetPrice = strikeRaw;
        }
        // Tentativa 3: Busca em strings adicionais (fallback)
        else {
          // Tenta extrair de price como string
          if (leg.price && typeof leg.price === "string") {
            const extracted = toNumber(leg.price);
            if (extracted > 0) {
              console.log(`Leg ${idx}: Preço extraído de string PRICE: ${extracted}`);
              assetPrice = extracted;
            }
          }
          // Tenta extrair de strike como string
          if (assetPrice === 0 && leg.strike && typeof leg.strike === "string") {
            const extracted = toNumber(leg.strike);
            if (extracted > 0) {
              console.log(`Leg ${idx}: Preço extraído de string STRIKE: ${extracted}`);
              assetPrice = extracted;
            }
          }
        }

        if (assetPrice <= 0) {
          console.error(`Leg ${idx}: ERRO CRÍTICO - Preço do ativo não encontrado. Strike: ${strikeRaw}, Price: ${priceRaw}, Raw Strike: ${leg.strike}, Raw Price: ${leg.price}`);
          return null;
        }

        // Validação: preço de ação deve estar entre 0.01 e 10000
        if (assetPrice < 0.01 || assetPrice > 10000) {
          console.error(`Leg ${idx}: Preço de ativo fora do intervalo válido: ${assetPrice}`);
          return null;
        }

        strike = assetPrice;
        price = 0;
      } else {
        // Validação para opções
        if (strike <= 0) {
          console.warn(`Leg ${idx}: Strike inválido (${strikeRaw})`);
          return null;
        }
        if (price <= 0) {
          console.warn(`Leg ${idx}: Prêmio inválido (${priceRaw})`);
          return null;
        }
      }

      const rawQty = Math.max(1, Math.round(toNumber(leg.quantity) || 100));
      const quantity = Math.abs(rawQty);

      if (quantity <= 0) {
        console.warn(`Leg ${idx}: Quantidade inválida (${rawQty})`);
        return null;
      }

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
            content: `Você é especialista em leitura de screenshots de plataformas brasileiras de opções (Clear, XP, BTG, Profit, Rico, Inter, Nubank, etc).

OBJETIVO CRÍTICO: Extrair TODAS as pernas com 100% de precisão. O preço do ativo é ABSOLUTAMENTE CRÍTICO - nunca deixe em branco ou zero. Procure em TODOS os campos da linha.

REGRAS ABSOLUTAS:

1. SIDE: "buy" (Compra/C) ou "sell" (Venda/V)

2. OPTION_TYPE: 
   - "call" para Call
   - "put" para Put
   - "stock" para Ativo-Objeto (PETR4, VALE3, etc - sem Call/Put)

3. ASSET: Ticker em MAIÚSCULAS (PETR4, PETRC405, etc)
   - Ativo-objeto: 4-5 caracteres (PETR4, VALE3, BBAS3)
   - Opção: 7 caracteres (PETRC405, VALEJ405)

4. STRIKE: 
   - Para opções: preço de exercício (39.65, 30.00)
   - Para ativos (stock): SEMPRE o preço unitário (39.61, 25.50, etc)
   - CRÍTICO: Nunca deixe em branco ou zero para ativos!
   - Se o preço estiver em "Preço", coloque em STRIKE
   - Se o preço estiver em "Strike", coloque em STRIKE
   - Se o preço estiver em qualquer outro campo, AINDA ASSIM coloque em STRIKE
   - Procure em TODAS as colunas da linha do ativo

5. PRICE:
   - Para opções: prêmio (0.80, 1.50)
   - Para ativos: SEMPRE 0 (zero) - NÃO coloque o preço do ativo aqui

6. QUANTITY: Número inteiro >= 1 (padrão 100)

7. REGRA DE OURO PARA ATIVOS:
   - Se a linha tem um ticker de 4-5 caracteres (PETR4, VALE3, BBAS3), é um ATIVO
   - Ativos SEMPRE têm um preço unitário visível na linha
   - Procure esse preço em: coluna "Preço", coluna "Strike", coluna "Bid", coluna "Ask", ou qualquer valor numérico > 0 na linha
   - Se encontrar múltiplos valores, escolha o que faz sentido (ex: 39.61 para PETR4)

EXEMPLO CORRETO (Compra Coberta):
Linha 1: side=sell, option_type=call, asset=PETRC405, strike=39.65, price=0.80, quantity=100
Linha 2: side=buy, option_type=stock, asset=PETR4, strike=39.61, price=0, quantity=100

CHECKLIST FINAL:
✓ Cada linha da tabela = uma perna?
✓ Ativos têm preço em STRIKE, 0 em PRICE?
✓ Nenhum preço ficou zero para ativos?
✓ Número de pernas = número de linhas?
✓ Preço de ativo está entre 0.01 e 10000?`,
          },
          {
            role: "user",
            content: [
              { type: "text", text: "INSTRUÇÕES CRÍTICAS:\n1. Extraia TODAS as pernas com máxima precisão\n2. ESPECIAL ATENÇÃO AO PREÇO DO ATIVO - ele NUNCA pode ser zero\n3. Se vir um ativo (como PETR4, VALE3, BBAS3, etc), o preço DEVE estar em STRIKE\n4. Procure o preço do ativo em TODOS os campos da linha (Preço, Strike, Bid, Ask, etc)\n5. Valide que o número de pernas extraídas = número de linhas na tabela\n6. Se houver dúvida, escolha o valor numérico que faz sentido para o ativo\n7. NUNCA deixe preço de ativo em branco ou zero" },
              { type: "image_url", image_url: { url: resolvedImage } },
            ],
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_legs",
              description: "Extrai todas as pernas com validação crítica de preço de ativo",
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
                    },
                  },
                  total_rows_in_image: { type: "number" },
                },
                required: ["legs", "total_rows_in_image"],
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

    console.log("OCR Extraction Summary:", {
      extracted: parsedTool?.legs?.length,
      imageRows: parsedTool?.total_rows_in_image,
      legs: parsedTool?.legs,
    });

    const normalized = normalizeLegs(parsedTool?.legs);

    if (normalized.length !== parsedTool?.total_rows_in_image) {
      console.warn(`Mismatch: Extracted ${normalized.length} legs but image has ${parsedTool?.total_rows_in_image} rows.`);
    }

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
