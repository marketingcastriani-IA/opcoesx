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
  
  // Detecção direta
  if (raw === "CALL" || raw === "C") return "call";
  if (raw === "PUT" || raw === "P") return "put";
  if (raw === "STOCK" || raw === "AÇÃO" || raw === "ACAO" || raw === "ATIVO" || raw === "BASE" || raw === "-" || raw === "") {
    return "stock";
  }
  
  // Se o campo está vazio ou é "-", tenta inferir pelo ticker
  if ((!raw || raw === "-") && asset) {
    const assetUpper = asset.toUpperCase();
    // Tickers de opções têm 7+ caracteres e contêm letras de mês (A-L para calls, M-X para puts)
    if (assetUpper.length >= 7) {
      const monthLetter = assetUpper[4];
      if (/[A-L]/.test(monthLetter)) return "call";
      if (/[M-X]/.test(monthLetter)) return "put";
    }
    // Se é apenas 4-5 caracteres, é ativo-objeto
    if (assetUpper.length <= 5) return "stock";
  }
  
  return null;
};

const validateAsset = (asset?: string): string | null => {
  if (!asset) return null;
  const cleaned = asset.trim().toUpperCase();
  // Ticker válido: 4-7 caracteres alfanuméricos
  if (/^[A-Z0-9]{4,7}$/.test(cleaned)) {
    return cleaned;
  }
  return null;
};

const normalizeLegs = (legs: RawLeg[] | undefined) => {
  if (!Array.isArray(legs)) return [];

  return legs
    .map((leg, idx) => {
      // Validação de ativo primeiro
      const asset = validateAsset(leg.asset);
      if (!asset) {
        console.warn(`Leg ${idx}: Asset inválido ou vazio:`, leg.asset);
        return null;
      }

      // Detecção de tipo de opção
      const optionType = normalizeOptionType(leg.option_type, asset);
      if (!optionType) {
        console.warn(`Leg ${idx}: Tipo de opção não reconhecido:`, leg.option_type);
        return null;
      }

      // Detecção de lado
      const side = normalizeSide(leg.side, optionType);
      if (!side) {
        console.warn(`Leg ${idx}: Lado (Compra/Venda) não reconhecido:`, leg.side);
        return null;
      }

      // Processamento de strike e price
      const strikeRaw = toNumber(leg.strike);
      const priceRaw = toNumber(leg.price);

      let strike = strikeRaw;
      let price = priceRaw;

      if (optionType === "stock") {
        // Para ativo-objeto: aceita preço em qualquer campo (strike ou price)
        // Prioriza o campo que tem valor > 0
        const validStrike = strikeRaw > 0 ? strikeRaw : priceRaw;
        
        if (validStrike <= 0) {
          console.warn(`Leg ${idx}: Preço do ativo inválido (strike: ${strikeRaw}, price: ${priceRaw})`);
          return null;
        }
        
        strike = validStrike;
        price = 0; // Sempre 0 para ativo-objeto
      } else {
        // Para opções: strike é o preço de exercício, price é o prêmio
        if (strike <= 0) {
          console.warn(`Leg ${idx}: Strike inválido (${strikeRaw})`);
          return null;
        }
        if (price <= 0) {
          console.warn(`Leg ${idx}: Prêmio inválido (${priceRaw})`);
          return null;
        }
      }

      // Validação de quantidade
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
            content: `Você é especialista em leitura de screenshots de plataformas brasileiras de opções (Clear, XP, BTG, Rico, Inter, Nubank, etc).

OBJETIVO: Extrair TODAS as pernas da grade de ordens/book de ofertas com 100% de precisão. NÃO invente pernas. NÃO omita pernas.

REGRAS CRÍTICAS DE EXTRAÇÃO:

1. **SIDE (Compra/Venda)**:
   - "buy" para Compra, C, Comprar
   - "sell" para Venda, V, Vender
   - Regra estrita: C = COMPRA (buy), V = VENDA (sell)

2. **OPTION_TYPE (Tipo de Instrumento)**:
   - "call" para Call, C (quando no campo de tipo)
   - "put" para Put, P (quando no campo de tipo)
   - "stock" para Ativo-Objeto (quando o campo Call/Put mostra "-", está vazio, mostra "Ação", ou é o ticker base como PETR4, VALE3, etc)
   - IMPORTANTE: Se uma linha tem um ticker base (ex: PETR4) sem indicação Call/Put, é um ativo-objeto (stock)

3. **ASSET (Ticker)**:
   - Sempre em MAIÚSCULAS
   - Exemplos válidos: PETR4, VALE3, PETRC405, PETRE30, PETRD325
   - Para opções: ticker base + letra de mês (A-L para calls, M-X para puts) + strike
   - Para ativos: ticker base apenas (4-5 caracteres)

4. **STRIKE (Preço de Exercício)**:
   - Para opções: preço de exercício como número decimal (ex: 39.65, 30.00)
   - Para ativos (stock): use o preço unitário de compra/venda do ativo (ex: 39.61)
   - CRÍTICO: Não deixe em branco ou zero para ativos!

5. **PRICE (Prêmio/Preço)**:
   - Para opções: prêmio como número decimal (ex: 0.80, 1.50)
   - Para ativos (stock): use 0 (zero)
   - CRÍTICO: Se o preço do ativo está no campo "Preço" em vez de "Strike", coloque no campo "price" (o sistema saberá reconhecer)

6. **QUANTITY (Quantidade)**:
   - Número inteiro >= 1
   - Nunca envie quantidade negativa
   - Padrão: 100 se não especificado

DUPLA VERIFICAÇÃO OBRIGATÓRIA:
- Conte quantas linhas a tabela da imagem possui
- O número de pernas extraídas DEVE ser igual ao número de linhas
- Se faltar alguma perna, revise e inclua

EXEMPLO DE ESTRUTURA CORRETA (Compra Coberta):
Linha 1: side=sell, option_type=call, asset=PETRC405, strike=39.65, price=0.80, quantity=100
Linha 2: side=buy, option_type=stock, asset=PETR4, strike=39.61, price=0, quantity=100
(Nota: O preço do ativo (39.61) está em STRIKE, e PRICE é 0)

ALTERNATIVA ACEITA (se OCR coloca preço em "price"):
Linha 2: side=buy, option_type=stock, asset=PETR4, strike=0, price=39.61, quantity=100
(O sistema saberá reconhecer e usar o valor correto)

EXEMPLO DE ESTRUTURA CORRETA (Trava de Alta):
Linha 1: side=buy, option_type=call, asset=PETRD30, strike=30.00, price=1.50, quantity=100
Linha 2: side=sell, option_type=call, asset=PETRD32, strike=32.00, price=0.50, quantity=100`,
          },
          {
            role: "user",
            content: [
              { type: "text", text: "Extraia TODAS as pernas da operação desta imagem com máxima precisão. Cada linha da tabela é uma perna. Não omita nenhuma. Valide que o número total de pernas extraídas corresponde ao número de linhas visíveis na tabela. CRÍTICO: Para ativos (stock), certifique-se de extrair o preço corretamente, mesmo que esteja em campos diferentes." },
              { type: "image_url", image_url: { url: resolvedImage } },
            ],
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_legs",
              description: "Extrai todas as pernas de opções/ações da imagem com validação de precisão",
              parameters: {
                type: "object",
                properties: {
                  legs: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        side: { type: "string", enum: ["buy", "sell"], description: "Compra (buy) ou Venda (sell)" },
                        option_type: { type: "string", enum: ["call", "put", "stock"], description: "Tipo: call, put ou ativo-objeto (stock)" },
                        asset: { type: "string", description: "Ticker em maiúsculas (ex: PETR4, PETRC405)" },
                        strike: { type: "number", description: "Preço de exercício (ou preço do ativo para stock)" },
                        price: { type: "number", description: "Prêmio da opção (ou 0 para stock)" },
                        quantity: { type: "number", description: "Quantidade (inteiro >= 1)" },
                      },
                      required: ["side", "option_type", "asset", "strike", "price", "quantity"],
                      additionalProperties: false,
                    },
                  },
                  total_rows_in_image: {
                    type: "number",
                    description: "Número total de linhas/pernas visíveis na tabela da imagem para validação",
                  },
                  validation_notes: {
                    type: "string",
                    description: "Notas sobre a extração (ex: 'Detectadas 2 pernas: 1 call vendida + 1 ativo comprado')",
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

    console.log("OCR Extraction Summary:", {
      extracted: parsedTool?.legs?.length,
      imageRows: parsedTool?.total_rows_in_image,
      notes: parsedTool?.validation_notes,
    });

    const normalized = normalizeLegs(parsedTool?.legs);

    // Validação: se o número de pernas extraídas não corresponde ao número de linhas, log de aviso
    if (normalized.length !== parsedTool?.total_rows_in_image) {
      console.warn(
        `Mismatch: Extracted ${normalized.length} legs but image has ${parsedTool?.total_rows_in_image} rows. Review may be needed.`
      );
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
