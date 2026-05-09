/**
 * Cloudflare Pages Function — POST /api/order
 * ─────────────────────────────────────────────
 * يرسل بيانات الطلب إلى Google Apps Script Web App
 * الذي يحفظها في Google Sheets
 *
 * Environment Variables (Cloudflare Dashboard → Settings → Variables):
 *   GAS_URL          — رابط Web App الخاص بـ Google Apps Script
 *   GAS_SECRET       — مفتاح سري للتحقق من المصدر (اختياري)
 *   ALLOWED_ORIGIN   — نطاق موقعك (مثال: https://yourstore.pages.dev)
 */

interface OrderData {
  name:        string;
  phone:       string;
  wilaya:      string;
  address:     string;
  quantity:    string;
  notes?:      string;
  product:     string;
  price:       string;
  _timestamp?: string;
}

interface Env {
  GAS_URL:         string;
  GAS_SECRET?:     string;
  ALLOWED_ORIGIN?: string;
}

function corsHeaders(allowed: string) {
  return {
    'Access-Control-Allow-Origin':  allowed || '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function json(body: object, status: number, cors: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const cors = corsHeaders(env.ALLOWED_ORIGIN ?? '*');

  // ── Parse body ──
  let data: OrderData;
  try {
    data = await request.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400, cors);
  }

  // ── Validation ──
  const phoneClean = data.phone?.replace(/\s/g, '') ?? '';
  const errors: string[] = [];

  if (!data.name    || data.name.trim().length < 3)    errors.push('name');
  if (!phoneClean   || !/^(0\d{9}|(\+213)\d{9})$/.test(phoneClean)) errors.push('phone');
  if (!data.wilaya  || data.wilaya.trim() === '')       errors.push('wilaya');
  if (!data.address || data.address.trim().length < 5)  errors.push('address');

  if (errors.length) {
    return json({ error: 'Validation failed', fields: errors }, 422, cors);
  }

  // ── Build order ──
  const qty   = Math.min(parseInt(data.quantity ?? '1', 10) || 1, 10);
  const price = parseInt(data.price ?? '3500', 10);
  const orderId = `ORD-${Date.now()}`;

  const order = {
    orderId,
    timestamp:  new Date().toISOString(),
    // العميل
    name:       data.name.trim().slice(0, 80),
    phone:      phoneClean,
    wilaya:     data.wilaya.trim(),
    address:    data.address.trim().slice(0, 300),
    notes:      (data.notes ?? '').trim().slice(0, 200),
    // الطلب
    product:    data.product ?? 'HOCO J101B Astute 30000mAh',
    quantity:   qty,
    unitPrice:  price,
    total:      qty * price,
    currency:   'DZD',
    status:     'جديد',
    // Meta
    source:     request.headers.get('Referer') ?? 'direct',
    country:    request.headers.get('CF-IPCountry') ?? 'DZ',
    // Secret
    ...(env.GAS_SECRET ? { secret: env.GAS_SECRET } : {}),
  };

  // ── Send to Google Apps Script ──
  if (!env.GAS_URL) {
    console.warn('[ORDER] GAS_URL not configured');
    console.log('[ORDER]', JSON.stringify(order, null, 2));
    return json({ success: true, orderId, dev: true }, 200, cors);
  }

  try {
    // Apps Script Web App يعيد redirect 302 → نتبعه تلقائياً
    const gasRes = await fetch(env.GAS_URL, {
      method:   'POST',
      headers:  { 'Content-Type': 'text/plain;charset=utf-8' },
      body:     JSON.stringify(order),
      redirect: 'follow',
    });

    const body = await gasRes.text();
    console.log(`[GAS] ${gasRes.status} — ${body.slice(0, 120)}`);

  } catch (err) {
    // لا نوقف الطلب إذا فشل Apps Script
    console.error('[GAS] fetch error:', err);
  }

  return json({ success: true, orderId }, 200, cors);
};

export const onRequestOptions: PagesFunction = async () =>
  new Response(null, {
    status:  204,
    headers: corsHeaders('*'),
  });
