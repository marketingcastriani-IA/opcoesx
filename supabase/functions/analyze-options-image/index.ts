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
    if (assetUpper.length >= 6) {
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
  // B3 tickers: 4-5 chars for stocks (PETR4, VALE3), 5-8 chars for options (PETRA1, PETRC405, PETRO405)
  if (/^[A-Z]{3,6}[A-Z0-9]{1,4}$/.test(cleaned) && cleaned.length >= 4 && cleaned.length <= 10) {
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
        let assetPrice = 0;

        if (priceRaw > 0) {
          console.log(`Leg ${idx}: Preço encontrado no campo PRICE: ${priceRaw}`);
          assetPrice = priceRaw;
        } else if (strikeRaw > 0) {
          console.log(`Leg ${idx}: Preço encontrado no campo STRIKE: ${strikeRaw}`);
          assetPrice = strikeRaw;
        } else {
          if (leg.price && typeof leg.price === "string") {
            const extracted = toNumber(leg.price);
            if (extracted > 0) assetPrice = extracted;
          }
          if (assetPrice === 0 && leg.strike && typeof leg.strike === "string") {
            const extracted = toNumber(leg.strike);
            if (extracted > 0) assetPrice = extracted;
          }
        }

        // Se o preço não foi encontrado, permitir 0 (será preenchido depois pelo usuário)
        if (assetPrice > 0 && (assetPrice < 0.01 || assetPrice > 10000)) {
          console.error(`Leg ${idx}: Preço de ativo fora do intervalo: ${assetPrice}`);
          return null;
        }

        console.log(`Leg ${idx}: Ativo ${asset} com preço ${assetPrice || 'não encontrado - será preenchido depois'}`);
        strike = assetPrice > 0 ? assetPrice : 0;
        price = 0;
      } else {
        if (strike <= 0) {
          console.warn(`Leg ${idx}: Strike inválido (${strikeRaw})`);
          return null;
        }
        if (price < 0) {
          console.warn(`Leg ${idx}: Prêmio inválido (${priceRaw})`);
          return null;
        }
      }

      const rawQty = Math.max(1, Math.round(toNumber(leg.quantity) || 100));
      const quantity = Math.abs(rawQty);

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
        model: "google/gemini-2.5-pro",
        messages: [
          {
            role: "system",
            content: `Você é um especialista ABSOLUTO em leitura de screenshots de plataformas brasileiras de opções de ações (Clear, XP, BTG Pactual, Profit Pro, Rico, Inter, Nubank, Modal, Genial, etc).

MISSÃO: Extrair com 100% de precisão TODAS as pernas (legs) de uma operação estruturada de opções.

## COMO LER A TABELA

Cada LINHA da tabela do screenshot é UMA perna. Você DEVE extrair TODAS as linhas sem exceção.

### Identificação dos campos:

**SIDE (Compra/Venda)**:
- "C" ou "Compra" → "buy"
- "V" ou "Venda" → "sell"
- Se a coluna mostrar cores: Verde/Azul geralmente = Compra, Vermelho = Venda
- Para ativo-objeto sem indicação explícita, assuma "buy"

**OPTION_TYPE (Tipo)**:
- Se o ticker tem 5+ caracteres com letra na 5ª posição (ex: PETRC405, VALEJ380): é OPÇÃO
  - Letras A-L na 5ª posição → "call"
  - Letras M-X na 5ª posição → "put"
- Se o ticker tem 4-5 caracteres (ex: PETR4, VALE3, BBAS3): é "stock" (ativo-objeto)
- Se a coluna "Tipo" diz "Call" → "call", "Put" → "put"

**ASSET (Ticker)**:
- Copie EXATAMENTE como aparece no screenshot
- Exemplos válidos: PETR4, PETRC405, PETRO405, VALE3, VALEJ380, BBAS3, BBASE100
- NÃO modifique o ticker - copie letra por letra

**STRIKE**:
- Para opções: o preço de exercício (ex: 39.65, 40.50)
- Para ativo-objeto (stock): o PREÇO ATUAL do ativo (ex: 39.61)
- NUNCA deixe zero para stock!

**PRICE (Prêmio)**:
- Para opções: o prêmio pago/recebido (ex: 1.26, 0.53)
- Para ativo-objeto (stock): SEMPRE 0

**QUANTITY**:
- Número de contratos/ações (geralmente 100)

## EXEMPLO DE LEITURA

Se o screenshot mostra 3 linhas:
| C | PETRO405 | 39.65 | 1.26 | 100 |
| V | PETRC407 | 39.90 | 0.53 | 100 |
| C | PETR4    | 39.61 |      | 100 |

Resultado:
- Leg 1: side=buy, option_type=put, asset=PETRO405, strike=39.65, price=1.26, quantity=100
- Leg 2: side=sell, option_type=call, asset=PETRC407, strike=39.90, price=0.53, quantity=100
- Leg 3: side=buy, option_type=stock, asset=PETR4, strike=39.61, price=0, quantity=100

## REGRAS CRÍTICAS
1. NÚMERO DE PERNAS EXTRAÍDAS = NÚMERO DE LINHAS NA TABELA (obrigatório!)
2. Preço de stock NUNCA pode ser 0 - procure em QUALQUER campo da linha
3. Copie tickers EXATAMENTE como aparecem
4. Se houver dúvida, inclua a perna - é melhor ter pernas extras do que faltar`,
          },
          {
            role: "user",
            content: [
              { type: "text", text: "Extraia TODAS as pernas desta operação. Leia cada linha da tabela com máxima atenção. O número de pernas deve ser IGUAL ao número de linhas. Para ativo-objeto, o preço NUNCA pode ser zero." },
              { type: "image_url", image_url: { url: resolvedImage } },
            ],
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_legs",
              description: "Extrai todas as pernas de uma operação estruturada de opções",
              parameters: {
                type: "object",
                properties: {
                  legs: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        side: { type: "string", enum: ["buy", "sell"], description: "buy=Compra/C, sell=Venda/V" },
                        option_type: { type: "string", enum: ["call", "put", "stock"], description: "call, put, ou stock para ativo-objeto" },
                        asset: { type: "string", description: "Ticker EXATO como aparece (PETR4, PETRC405, PETRO405)" },
                        strike: { type: "number", description: "Strike da opção OU preço do ativo (NUNCA zero para stock)" },
                        price: { type: "number", description: "Prêmio da opção (0 para stock)" },
                        quantity: { type: "number", description: "Quantidade (geralmente 100)" },
                      },
                      required: ["side", "option_type", "asset", "strike", "price", "quantity"],
                    },
                  },
                  total_rows_in_image: { type: "number", description: "Número total de linhas na tabela do screenshot" },
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

    console.log("OCR Extraction Summary:", JSON.stringify({
      extracted: parsedTool?.legs?.length,
      imageRows: parsedTool?.total_rows_in_image,
      legs: parsedTool?.legs,
    }));

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
