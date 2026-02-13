import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

interface GateCheckRequest {
  rfid_ids: string[];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceKey) {
    console.error("Supabase env vars missing");
    return new Response(JSON.stringify({ error: "Supabase is not configured" }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    const body = (await req.json()) as GateCheckRequest;

    if (!body.rfid_ids || !Array.isArray(body.rfid_ids) || body.rfid_ids.length === 0) {
      return new Response(JSON.stringify({ error: "rfid_ids array is required" }), {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    const uniqueRfids = Array.from(new Set(body.rfid_ids.map((id) => String(id))));

    const { data, error } = await supabase
      .from('products')
      .select('id, name, rfid_id, is_paid, store_id')
      .in('rfid_id', uniqueRfids);

    if (error) {
      console.error('Error querying products for RFID check', error);
      return new Response(JSON.stringify({ error: 'Failed to check RFID tags' }), {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    const found = (data || []).filter((p) => p.rfid_id) as { id: string; name: string; rfid_id: string; is_paid: boolean; store_id: string }[];
    const foundRfids = new Set(found.map((p) => p.rfid_id));

    const missing = uniqueRfids.filter((id) => !foundRfids.has(id));
    const unpaid = found.filter((p) => !p.is_paid).map((p) => p.rfid_id);

    const allowed = missing.length === 0 && unpaid.length === 0;

    return new Response(
      JSON.stringify({
        allowed,
        missing,
        unpaid,
        products: found,
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      },
    );
  } catch (error) {
    console.error('RFID gate check error', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }
});
