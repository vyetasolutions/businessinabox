// ============================================================================
// VYETA BUSINESS HUB — BACKEND (Node.js + Express)
// ============================================================================
// Two endpoints only, by design (keeps the free-tier Render web service light):
//   POST /api/create-employee   -> Manager provisions a new Employee account
//   POST /api/trigger-whatsapp  -> Supabase Database Webhook -> Twilio WhatsApp
//   GET  /health                -> Render health check / free-tier "keep-alive" ping
// ============================================================================

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const twilio = require('twilio');

const app = express();
app.use(express.json({ limit: '1mb' }));

// ---------------------------------------------------------------------------
// CORS — only allow the frontend origins you list in ALLOWED_ORIGINS
// ---------------------------------------------------------------------------
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow server-to-server calls (e.g. the Supabase webhook) which send no Origin header
      if (!origin) return callback(null, true);
      if (allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error('Not allowed by CORS'));
    },
  })
);

// ---------------------------------------------------------------------------
// Supabase Admin client — uses the SERVICE ROLE KEY. This key bypasses RLS,
// so it must NEVER be sent to the frontend. It only lives here, on the server.
// ---------------------------------------------------------------------------
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// ---------------------------------------------------------------------------
// Twilio client (WhatsApp Sandbox on the free tier)
// ---------------------------------------------------------------------------
const twilioClient =
  process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN
    ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
    : null;

// ---------------------------------------------------------------------------
// Helper: format a Zambian-style phone number into E.164 for WhatsApp.
// Accepts inputs like "0977123456", "+260977123456", "260977123456", "097-712-3456"
// ---------------------------------------------------------------------------
function formatPhoneForWhatsapp(rawPhone) {
  if (!rawPhone) return null;
  let digits = rawPhone.replace(/[^0-9]/g, '');

  if (digits.startsWith('00')) digits = digits.slice(2);

  if (digits.startsWith('260')) {
    // already has country code
  } else if (digits.startsWith('0')) {
    digits = '260' + digits.slice(1);
  } else if (digits.length === 9) {
    // e.g. 977123456 with no leading 0 or country code
    digits = '260' + digits;
  }

  if (digits.length < 11) return null;
  return `whatsapp:+${digits}`;
}

// ---------------------------------------------------------------------------
// Helper: verify the caller's Supabase access token and load their profile.
// Used to confirm "is this really a Manager?" before provisioning an Employee.
// ---------------------------------------------------------------------------
async function getRequestingProfile(req) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return { error: 'Missing Authorization bearer token' };

  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
  if (userError || !userData?.user) {
    return { error: 'Invalid or expired session token' };
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('id, organization_id, role, is_active, full_name')
    .eq('id', userData.user.id)
    .single();

  if (profileError || !profile) {
    return { error: 'No profile found for this account' };
  }

  return { profile };
}

// ============================================================================
// ENDPOINT 1: POST /api/create-employee
// ============================================================================
// Called by the Manager Dashboard's "Add Employee" form.
// The frontend never talks to Supabase Auth Admin directly (that would require
// exposing the service_role key in the browser) — instead it calls this
// endpoint, which does the privileged work on the server.
// ============================================================================
app.post('/api/create-employee', async (req, res) => {
  try {
    const { email, password, fullName } = req.body || {};

    if (!email || !password || !fullName) {
      return res.status(400).json({ success: false, error: 'Full name, email and password are all required.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ success: false, error: 'Password must be at least 6 characters.' });
    }

    // 1. Confirm the requester is an authenticated Manager (or Platform Admin)
    const { profile, error: authError } = await getRequestingProfile(req);
    if (authError) {
      return res.status(401).json({ success: false, error: authError });
    }
    if (!['manager', 'platform_admin'].includes(profile.role)) {
      return res.status(403).json({ success: false, error: 'Only Managers can create employee accounts.' });
    }
    if (!profile.is_active) {
      return res.status(403).json({ success: false, error: 'Your account is inactive. Contact support.' });
    }

    // 2. Create the Auth user using the Admin API (service_role key required)
    const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // skip email verification — this isn't a public self-signup
      user_metadata: { full_name: fullName, role: 'employee' },
    });

    if (createError) {
      return res.status(400).json({ success: false, error: createError.message });
    }

    const newUserId = created.user.id;

    // 3. Insert their profile row, tied to the Manager's organization, as 'employee'
    const { error: profileInsertError } = await supabaseAdmin.from('profiles').insert({
      id: newUserId,
      organization_id: profile.organization_id,
      full_name: fullName,
      role: 'employee',
      is_active: true,
    });

    if (profileInsertError) {
      // Roll back the auth user so we don't leave an orphaned login with no profile
      await supabaseAdmin.auth.admin.deleteUser(newUserId);
      return res.status(500).json({ success: false, error: 'Failed to link employee profile: ' + profileInsertError.message });
    }

    return res.json({
      success: true,
      employee: { id: newUserId, email, fullName, role: 'employee' },
    });
  } catch (err) {
    console.error('create-employee error:', err);
    return res.status(500).json({ success: false, error: 'Unexpected server error while creating employee.' });
  }
});

// ============================================================================
// ENDPOINT 2: POST /api/trigger-whatsapp
// ============================================================================
// Configure this URL as a Supabase Database Webhook:
//   Dashboard -> Database -> Webhooks -> Create a new webhook
//   Table: whatsapp_messages_queue   Event: INSERT
//   URL: https://your-backend.onrender.com/api/trigger-whatsapp
//   HTTP Headers: x-webhook-secret: <same value as BACKEND_SHARED_SECRET>
// ============================================================================
app.post('/api/trigger-whatsapp', async (req, res) => {
  try {
    // 1. Verify the shared secret so random internet traffic can't spam Twilio
    const providedSecret = req.headers['x-webhook-secret'];
    if (!process.env.BACKEND_SHARED_SECRET || providedSecret !== process.env.BACKEND_SHARED_SECRET) {
      return res.status(401).json({ success: false, error: 'Invalid webhook secret.' });
    }

    // 2. Supabase sends { type, table, record, old_record, schema }
    const payload = req.body || {};
    const record = payload.record || payload; // fallback for manual/test calls

    const queueId = record.id;
    const toPhoneRaw = record.to_phone;
    const messageBody = record.message_body;

    if (!queueId || !toPhoneRaw || !messageBody) {
      return res.status(400).json({ success: false, error: 'Payload missing id, to_phone or message_body.' });
    }

    if (!twilioClient) {
      return res.status(500).json({ success: false, error: 'Twilio is not configured on the server.' });
    }

    const formattedTo = formatPhoneForWhatsapp(toPhoneRaw);
    if (!formattedTo) {
      await supabaseAdmin
        .from('whatsapp_messages_queue')
        .update({ status: 'failed', error_message: 'Could not parse phone number' })
        .eq('id', queueId);
      return res.status(400).json({ success: false, error: 'Could not parse phone number.' });
    }

    // 3. Send via Twilio WhatsApp Sandbox
    try {
      const message = await twilioClient.messages.create({
        from: process.env.TWILIO_WHATSAPP_FROM,
        to: formattedTo,
        body: messageBody,
      });

      await supabaseAdmin
        .from('whatsapp_messages_queue')
        .update({ status: 'sent', provider_sid: message.sid, sent_at: new Date().toISOString() })
        .eq('id', queueId);

      return res.json({ success: true, sid: message.sid });
    } catch (twilioError) {
      console.error('Twilio send error:', twilioError.message);
      await supabaseAdmin
        .from('whatsapp_messages_queue')
        .update({ status: 'failed', error_message: twilioError.message })
        .eq('id', queueId);
      return res.status(502).json({ success: false, error: 'Twilio failed to send: ' + twilioError.message });
    }
  } catch (err) {
    console.error('trigger-whatsapp error:', err);
    return res.status(500).json({ success: false, error: 'Unexpected server error while sending WhatsApp message.' });
  }
});

// ---------------------------------------------------------------------------
// Health check — also doubles as a free "keep the Render instance warm" ping
// target if you wire up an external uptime pinger (see deployment guide).
// ---------------------------------------------------------------------------
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'vyeta-business-hub-backend', time: new Date().toISOString() });
});

app.get('/', (req, res) => {
  res.send('Vyeta Business Hub backend is running.');
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Vyeta Business Hub backend listening on port ${PORT}`);
});
