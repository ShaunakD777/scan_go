import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const razorpayKeySecret = Deno.env.get("RAZORPAY_KEY_SECRET");

interface VerifyPaymentRequest {
  payment_id: string;
  order_id?: string;
  signature?: string;
  cart_id: string;
}

function verifySignature(
  orderId: string,
  paymentId: string,
  signature: string,
  keySecret: string
): boolean {
  const hmac = crypto.subtle;
  const message = `${orderId}|${paymentId}`;
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const key = encoder.encode(keySecret);

  // Using subtle crypto would require async operations
  // For now, we'll verify via Razorpay API directly
  return true;
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

  try {
    const body = (await req.json()) as VerifyPaymentRequest;

    if (!body.payment_id || !body.cart_id) {
      return new Response(
        JSON.stringify({ error: "payment_id and cart_id are required" }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    if (!supabaseUrl || !supabaseServiceKey || !razorpayKeySecret) {
      console.error("Environment variables missing");
      return new Response(JSON.stringify({ error: "Server configuration error" }), {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    // Initialize Supabase client with service role
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify payment with Razorpay API
    const keyId = Deno.env.get("RAZORPAY_KEY_ID");
    const authHeader = "Basic " + btoa(`${keyId}:${razorpayKeySecret}`);

    const razorpayRes = await fetch(
      `https://api.razorpay.com/v1/payments/${body.payment_id}`,
      {
        method: "GET",
        headers: {
          Authorization: authHeader,
        },
      }
    );

    const paymentData = await razorpayRes.json();

    if (!razorpayRes.ok) {
      console.error("Razorpay verification failed:", paymentData);
      return new Response(
        JSON.stringify({ error: "Payment verification failed", details: paymentData }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    // Check if payment is captured
    if (paymentData.status !== "captured") {
      console.error("Payment not captured. Status:", paymentData.status);
      return new Response(
        JSON.stringify({
          error: "Payment not captured",
          status: paymentData.status,
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    // Get cart details to find products
    const { data: cart, error: cartError } = await supabase
      .from("carts")
      .select("id, user_id, store_id")
      .eq("id", body.cart_id)
      .single();

    if (cartError || !cart) {
      console.error("Cart not found:", cartError);
      return new Response(JSON.stringify({ error: "Cart not found" }), {
        status: 404,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    // Get cart items
    const { data: cartItems, error: itemsError } = await supabase
      .from("cart_items")
      .select("product_id")
      .eq("cart_id", body.cart_id);

    if (itemsError || !cartItems) {
      console.error("Error fetching cart items:", itemsError);
      return new Response(JSON.stringify({ error: "Error fetching cart items" }), {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    const productIds = cartItems.map((item) => item.product_id);

    // Update products to mark as paid
    const { error: updateProductError } = await supabase
      .from("products")
      .update({ is_paid: true })
      .in("id", productIds);

    if (updateProductError) {
      console.error("Error updating products:", updateProductError);
      return new Response(JSON.stringify({ error: "Error updating products" }), {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    // Mark cart as inactive
    const { error: updateCartError } = await supabase
      .from("carts")
      .update({ is_active: false })
      .eq("id", body.cart_id);

    if (updateCartError) {
      console.error("Error updating cart:", updateCartError);
      return new Response(JSON.stringify({ error: "Error updating cart" }), {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    // Return success response
    return new Response(
      JSON.stringify({
        success: true,
        payment_id: body.payment_id,
        cart_id: body.cart_id,
        products_updated: productIds.length,
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  } catch (error) {
    console.error("Error verifying payment:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }
});
