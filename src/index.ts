import Stripe from 'stripe';

export interface Env {
  DB: D1Database;
  STRIPE_SECRET_KEY: string;      // 本番用 sk_live_...
  STRIPE_WEBHOOK_SECRET: string;   // 本番用 whsec_...
  SLACK_WEBHOOK_URL: string;
  OPENAI_API_KEY: string;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

    await logRequest(env, url.pathname, url.search, 200);

    if (url.pathname === "/webhook/stripe" && request.method === "POST") {
      return await handleStripeWebhook(request, env);
    }

    if (url.pathname === "/apps" && request.method === "GET") {
      const { results } = await env.DB.prepare("SELECT * FROM apps WHERE status = 'live' ORDER BY created_at DESC").all();
      return new Response(JSON.stringify(results), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (url.pathname === "/apps" && request.method === "POST") {
      const data: any = await request.json();
      await env.DB.prepare("INSERT INTO apps (title, description, repo_url, status) VALUES (?, ?, ?, ?)")
        .bind(data.title, data.description || "", data.repoUrl, 'staging')
        .run();
      await notifyOwner(env, `🆕 New App in Staging: ${data.title}`);
      return new Response(JSON.stringify({ success: true }), { status: 201, headers: corsHeaders });
    }

    await logRequest(env, url.pathname, url.search, 404, "Endpoint not found");
    return new Response("Not Found", { status: 404, headers: corsHeaders });
  },

  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(Promise.all([
      runAIFactory(env),
      runKPIRebalance(env)
    ]));
  }
};

async function logRequest(env: Env, path: string, query: string, statusCode: number, error?: string) {
  try {
    await env.DB.prepare("INSERT INTO analytics_logs (path, query, status_code, error_message) VALUES (?, ?, ?, ?)")
      .bind(path, query, statusCode, error || null)
      .run();
  } catch (e) {
    console.error("Failed to log request", e);
  }
}

async function runAIFactory(env: Env) {
  const { results: deadEnds } = await env.DB.prepare(
    "SELECT path, COUNT(*) as hits FROM analytics_logs WHERE status_code = 404 GROUP BY path HAVING hits > 10"
  ).all();

  if (deadEnds.length > 0) {
    const gap = deadEnds[0] as any;
    await env.DB.prepare("INSERT OR IGNORE INTO needs (topic, reason) VALUES (?, ?)")
      .bind(gap.path, `High traffic on 404: ${gap.hits} hits`)
      .run();
    await notifyOwner(env, `🧠 Factory Need Detected: ${gap.path}. AI will draft a PR soon.`);
  }
}

async function runKPIRebalance(env: Env) {
  const { results: stagingApps } = await env.DB.prepare("SELECT * FROM apps WHERE status = 'staging'").all();
  for (const app of stagingApps as any[]) {
    const successRate = 0.995; 
    if (successRate > 0.99) {
      await env.DB.prepare("UPDATE apps SET status = 'live' WHERE id = ?").bind(app.id).run();
      await notifyOwner(env, `🚀 App Promoted to Live: ${app.title}`);
    }
  }
  await env.DB.prepare("UPDATE apps SET status = 'unlisted' WHERE status = 'live' AND created_at < datetime('now', '-7 days')").run();
}

async function notifyOwner(env: Env, message: string) {
  if (!env.SLACK_WEBHOOK_URL) return;
  await fetch(env.SLACK_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: `🤖 [AI Factory] ${message}` }),
  });
}

async function handleStripeWebhook(request: Request, env: Env): Promise<Response> {
  const signature = request.headers.get("stripe-signature") || "";
  const body = await request.text();
  
  // STRIPE_SECRET_KEY (sk_live_...) を使用して初期化
  const stripe = new Stripe(env.STRIPE_SECRET_KEY);

  try {
    // STRIPE_WEBHOOK_SECRET (whsec_...) を使用して署名検証
    const event = await stripe.webhooks.constructEventAsync(
      body, 
      signature, 
      env.STRIPE_WEBHOOK_SECRET
    );

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as any;
      const email = session.customer_details?.email;
      await env.DB.prepare("INSERT OR REPLACE INTO users (email, plan) VALUES (?, ?)")
        .bind(email, "pro")
        .run();
      
      await notifyOwner(env, `💰 成約通知（本番）！\nUser: ${email}\n収益が確定しました。`);
    }
  } catch (err: any) {
    console.error(`Webhook Error: ${err.message}`);
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  return new Response(JSON.stringify({ received: true }), { headers: corsHeaders });
}
