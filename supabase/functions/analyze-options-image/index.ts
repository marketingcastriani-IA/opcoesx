import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { image } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

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
            content: `You are an expert at reading Brazilian options trading platform screenshots. Extract the option legs from the image. Return ONLY a JSON object with a "legs" array. Each leg must have: side ("buy" or "sell"), option_type ("call" or "put"), asset (string, e.g. "PETR4"), strike (number), price (number), quantity (number, default 1). If you cannot read the image clearly, return {"legs": []}.`
          },
          {
            role: "user",
            content: [
              { type: "text", text: "Extract the option legs from this trading platform screenshot." },
              { type: "image_url", image_url: { url: `data:image/png;base64,${image}` } }
            ]
          }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_legs",
              description: "Extract option legs from the screenshot",
              parameters: {
                type: "object",
                properties: {
                  legs: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        side: { type: "string", enum: ["buy", "sell"] },
                        option_type: { type: "string", enum: ["call", "put"] },
                        asset: { type: "string" },
                        strike: { type: "number" },
                        price: { type: "number" },
                        quantity: { type: "number" }
                      },
                      required: ["side", "option_type", "asset", "strike", "price", "quantity"],
                      additionalProperties: false
                    }
                  }
                },
                required: ["legs"],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "extract_legs" } }
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
    const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      const parsed = JSON.parse(toolCall.function.arguments);
      return new Response(JSON.stringify(parsed), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ legs: [] }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-options-image error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
