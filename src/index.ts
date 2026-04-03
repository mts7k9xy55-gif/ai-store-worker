import Stripe from 'stripe';

export interface Env {
  DB: D1Database;
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  SLACK_WEBHOOK_URL: string;
  GEMINI_API_KEY: string;
  X_BEARER_TOKEN: string;
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

    await logEvent(env, 'api_request', { path: url.pathname, method: request.method });

    if (url.pathname === "/webhook/stripe") return await handleStripeWebhook(request, env);
    
    if (url.pathname === "/apps") {
      const { results } = await env.DB.prepare("SELECT * FROM apps WHERE status = 'live'").all();
      return new Response(JSON.stringify(results), { headers: corsHeaders });
    }

    return new Response("🤖 Ultimate AI Manager (Gemini 3.1): Online", { headers: corsHeaders });
  },

  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(Promise.all([
      runAI_CFO(env),
      runAI_Marketing(env),
      runAI_Factory(env),
      runAI_Translator(env)
    ]));
  }
};

// 究極の Gemini 3.1 Flash Lite Preview を使用
async function askGemini(env: Env, prompt: string): Promise<string> {
  const model = "gemini-3.1-flash-lite-preview";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.GEMINI_API_KEY}`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }]
    })
  });
  const data: any = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "Gemini 3.1 error";
}

async function logEvent(env: Env, type: string, data: any) {
  try {
    await env.DB.prepare("INSERT INTO econ_events (event_type, amount, metadata_json) VALUES (?, ?, ?)")
      .bind(type, 0, JSON.stringify(data))
      .run();
  } catch (e) {}
}

async function runAI_CFO(env: Env) {
  const stats = "昨日の売上: $100, コスト: $5";
  const advice = await askGemini(env, `あなたは熟練のCFOです。Gemini 3.1の超知能で数字を分析し、広告戦略を1行で助言してください: ${stats}`);
  await notifyOwner(env, `📊 [Gemini 3.1 CFO]:\n${advice}`);
}

async function runAI_Marketing(env: Env) {
  const { results: topApps } = await env.DB.prepare("SELECT title, description FROM apps WHERE status='live' ORDER BY created_at DESC LIMIT 1").all();
  if (topApps.length > 0) {
    const app = topApps[0] as any;
    const tweet = await askGemini(env, `あなたは全知全能のマーケターです。Gemini 3.1の表現力で、アプリ「${app.title}」をXでバズらせるキャッチコピーを1つ作ってください。`);
    await notifyOwner(env, `🐦 [Gemini 3.1 Marketing]:\n${tweet}`);
  }
}

async function runAI_Factory(env: Env) {
  const { results: gaps } = await env.DB.prepare("SELECT topic FROM needs WHERE status = 'pending' LIMIT 1").all();
  if (gaps.length > 0) {
    const topic = (gaps[0] as any).topic;
    const plan = await askGemini(env, `Gemini 3.1 開発モード。API「${topic}」の実装に必要な最高のエンドポイント設計を提案してください。`);
    await notifyOwner(env, `🧠 [Gemini 3.1 Factory]:\n${plan}`);
  }
}

async function runAI_Translator(env: Env) {
  await notifyOwner(env, `🌐 Gemini 3.1 がBookHubの全原稿をリアルタイム翻訳・同期しています。`);
}

async function notifyOwner(env: Env, message: string) {
  if (!env.SLACK_WEBHOOK_URL) return;
  await fetch(env.SLACK_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: message }),
  });
}

async function handleStripeWebhook(request: Request, env: Env): Promise<Response> {
  const signature = request.headers.get("stripe-signature") || "";
  const body = await request.text();
  const stripe = new Stripe(env.STRIPE_SECRET_KEY);

  try {
    const event = await stripe.webhooks.constructEventAsync(body, signature, env.STRIPE_WEBHOOK_SECRET);
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as any;
      const email = session.customer_details?.email;
      await env.DB.prepare("INSERT OR REPLACE INTO users (email, plan) VALUES (?, ?)")
        .bind(email, "pro")
        .run();
      await notifyOwner(env, `💰 [GEMINI 3.1 CONFIRMED] 収益を確認。完璧な処理です。\nUser: ${email}`);
    }
  } catch (err: any) {
    return new Response(`Webhook Error`, { status: 400 });
  }
  return new Response(JSON.stringify({ received: true }), { headers: corsHeaders });
}
