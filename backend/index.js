// ============================================================================
// VYETA BUSINESS HUB — BACKEND (Node.js + Express)
// ============================================================================

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const twilio = require('twilio');
const { initiateMobileMoneyCollection, getCollectionStatusByReference } = require('./lenco');

const app = express();
app.use(express.json({ limit: '1mb' }));

const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error('Not allowed by CORS'));
    },
  })
);

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const twilioClient =
  process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN
    ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
    : null;

const PLAN_PRICES = {
  starter: 149,
  professional: 299,
  business_plus: 599
};

// ---------------------------------------------------------------------------
// Vyeta Credits integration config. Requires Node 18+ for global fetch.
// ---------------------------------------------------------------------------
const VYETA_URL = process.env.VYETA_URL;
const VYETA_ANON_KEY = process.env.VYETA_ANON_KEY;
const VYETA_API_KEY = process.env.VYETA_API_KEY;
const VYETA_WEBHOOK_SECRET = process.env.VYETA_WEBHOOK_SECRET;

async function callVyetaRPC(rpcName, body) {
  const res = await fetch(`${VYETA_URL}/rest/v1/rpc/${rpcName}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: VYETA_ANON_KEY,
      Authorization: `Bearer ${VYETA_ANON_KEY}`,
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Vyeta RPC ${rpcName} failed: ${text}`);
  return text ? JSON.parse(text) : null;
}

async function createVyetaIntent({ organizationId, organizationName, plan, amount, purpose, extraMetadata }) {
  if (!VYETA_URL || !VYETA_ANON_KEY || !VYETA_API_KEY) return null;
  try {
    const result = await callVyetaRPC('external_create_charge_intent', {
      p_api_key: VYETA_API_KEY,
      p_external_ref: organizationId,
      p_amount_zmw: amount,
      p_purpose: purpose,
      p_metadata: { organization_name: organizationName, plan, ...extraMetadata },
    });
    return result?.[0]?.tx_ref || null;
  } catch (err) {
    console.error('createVyetaIntent failed (non-fatal):', err.message);
    return null;
  }
}

async function completeVyetaIntent(txRef, status, externalReference, failureReason) {
  if (!txRef || !VYETA_URL || !VYETA_ANON_KEY || !VYETA_API_KEY) return;
  try {
    await callVyetaRPC('external_complete_charge_intent', {
      p_api_key: VYETA_API_KEY,
      p_tx_ref: txRef,
      p_status: status,
      p_external_reference: externalReference || null,
      p_failure_reason: failureReason || null,
    });
  } catch (err) {
    console.error('completeVyetaIntent failed (non-fatal):', err.message);
  }
}

function formatPhoneForWhatsapp(rawPhone) {
  if (!rawPhone) return null;
  let digits = rawPhone.replace(/[^0-9]/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.startsWith('260')) {
    // already has country code
  } else if (digits.startsWith('0')) {
    digits = '260' + digits.slice(1);
  } else if (digits.length === 9) {
    digits = '260' + digits;
  }
  if (digits.length < 11) return null;
  return `whatsapp:+${digits}`;
}

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
app.post('/api/create-employee', async (req, res) => {
  try {
    const { email, password, fullName } = req.body || {};

    if (!email || !password || !fullName) {
      return res.status(400).json({ success: false, error: 'Full name, email and password are all required.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ success: false, error: 'Password must be at least 6 characters.' });
    }

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

    const { data: org, error: orgFetchError } = await supabaseAdmin
      .from('organizations')
      .select('plan')
      .eq('id', profile.organization_id)
      .single();

    if (orgFetchError || !org) {
      return res.status(500).json({ success: false, error: 'Could not verify your plan.' });
    }
    if (org.plan !== 'business_plus') {
      return res
        .status(403)
        .json({ success: false, error: 'Adding staff accounts is a Business Plus feature. Upgrade your plan to add employees.' });
    }

    const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName, role: 'employee' },
    });

    if (createError) {
      return res.status(400).json({ success: false, error: createError.message });
    }

    const newUserId = created.user.id;

    const { error: profileInsertError } = await supabaseAdmin.from('profiles').insert({
      id: newUserId,
      organization_id: profile.organization_id,
      full_name: fullName,
      role: 'employee',
      is_active: true,
    });

    if (profileInsertError) {
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
app.post('/api/trigger-whatsapp', async (req, res) => {
  try {
    const providedSecret = req.headers['x-webhook-secret'];
    if (!process.env.BACKEND_SHARED_SECRET || providedSecret !== process.env.BACKEND_SHARED_SECRET) {
      return res.status(401).json({ success: false, error: 'Invalid webhook secret.' });
    }

    const payload = req.body || {};
    const record = payload.record || payload;

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

// ============================================================================
// ENDPOINT 3: POST /api/signup-business
// ============================================================================
app.post('/api/signup-business', async (req, res) => {
  try {
    const { businessName, fullName, email, password, phone } = req.body || {};

    if (!businessName || !fullName || !email || !password) {
      return res.status(400).json({ success: false, error: 'Business name, your name, email and password are all required.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ success: false, error: 'Password must be at least 6 characters.' });
    }

    const { data: org, error: orgError } = await supabaseAdmin
      .from('organizations')
      .insert({ name: businessName, phone: phone || null, status: 'pending' })
      .select()
      .single();

    if (orgError) {
      return res.status(500).json({ success: false, error: 'Could not create business: ' + orgError.message });
    }

    const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName, role: 'manager' },
    });

    if (createError) {
      await supabaseAdmin.from('organizations').delete().eq('id', org.id);
      return res.status(400).json({ success: false, error: createError.message });
    }

    const { error: profileError } = await supabaseAdmin.from('profiles').insert({
      id: created.user.id,
      organization_id: org.id,
      full_name: fullName,
      role: 'manager',
      is_active: true,
    });

    if (profileError) {
      await supabaseAdmin.auth.admin.deleteUser(created.user.id);
      await supabaseAdmin.from('organizations').delete().eq('id', org.id);
      return res.status(500).json({ success: false, error: 'Failed to set up your account: ' + profileError.message });
    }

    return res.json({
      success: true,
      message: 'Account created! Your business is pending approval before you can start using the platform.',
    });
  } catch (err) {
    console.error('signup-business error:', err);
    return res.status(500).json({ success: false, error: 'Unexpected server error while signing up.' });
  }
});

// ---------------------------------------------------------------------------
async function activateSubscription(organizationId, plan) {
  const periodEnd = new Date();
  periodEnd.setDate(periodEnd.getDate() + 30);
  await supabaseAdmin
    .from('organizations')
    .update({ plan, subscription_status: 'active', current_period_end: periodEnd.toISOString() })
    .eq('id', organizationId);
}

// ============================================================================
// ENDPOINT 6: POST /api/billing/initiate-payment (Lenco path)
// ============================================================================
app.post('/api/billing/initiate-payment', async (req, res) => {
  try {
    const { profile, error: authError } = await getRequestingProfile(req);
    if (authError) return res.status(401).json({ success: false, error: authError });
    if (!['manager', 'platform_admin'].includes(profile.role)) {
      return res.status(403).json({ success: false, error: 'Only Managers can manage billing.' });
    }

    const { plan, phone, operator } = req.body || {};
    if (!PLAN_PRICES[plan]) {
      return res.status(400).json({ success: false, error: 'Invalid plan selected.' });
    }
    if (!phone || !['mtn', 'airtel', 'zamtel'].includes(operator)) {
      return res.status(400).json({ success: false, error: 'A valid phone number and mobile money network are required.' });
    }
    if (!process.env.LENCO_API_KEY) {
      return res.status(500).json({ success: false, error: 'Card/mobile money checkout is not live yet. Use manual payment instead.' });
    }

    const amount = PLAN_PRICES[plan];
    const reference = `vyeta-${profile.organization_id}-${Date.now()}`;

    const { data: org } = await supabaseAdmin.from('organizations').select('name').eq('id', profile.organization_id).single();

    const vyetaTxRef = await createVyetaIntent({
      organizationId: profile.organization_id,
      organizationName: org?.name || 'Unknown',
      plan,
      amount,
      purpose: 'business_suite_subscription',
      extraMetadata: { payment_method: 'lenco' },
    });

    const { error: insertError } = await supabaseAdmin.from('subscription_payments').insert({
      organization_id: profile.organization_id,
      plan,
      amount,
      reference,
      phone,
      operator,
      status: 'pending',
      payment_method: 'lenco',
      vyeta_tx_ref: vyetaTxRef,
    });
    if (insertError) {
      return res.status(500).json({ success: false, error: 'Could not start payment: ' + insertError.message });
    }

    const lencoResult = await initiateMobileMoneyCollection({ amount, reference, phone, operator });

    if (!lencoResult.status) {
      await supabaseAdmin.from('subscription_payments').update({ status: 'failed' }).eq('reference', reference);
      await completeVyetaIntent(vyetaTxRef, 'failed', null, lencoResult.message || 'Lenco rejected the request');
      return res.status(400).json({ success: false, error: lencoResult.message || 'Payment could not be started.' });
    }

    const lencoReference = lencoResult.data?.lencoReference || null;
    const lencoStatus = lencoResult.data?.status || 'pending';

    await supabaseAdmin
      .from('subscription_payments')
      .update({ lenco_reference: lencoReference, status: lencoStatus === 'failed' ? 'failed' : 'pending' })
      .eq('reference', reference);

    if (lencoStatus === 'failed') {
      await completeVyetaIntent(vyetaTxRef, 'failed', lencoReference, 'Lenco reported failure at initiation');
    }

    return res.json({
      success: true,
      reference,
      status: lencoStatus,
      message:
        lencoStatus === 'pay-offline'
          ? 'Check your phone to authorize the payment.'
          : 'Payment initiated — check your phone.'
    });
  } catch (err) {
    console.error('initiate-payment error:', err);
    return res.status(500).json({ success: false, error: 'Unexpected server error while starting payment.' });
  }
});

// ============================================================================
// ENDPOINT 6b: POST /api/billing/initiate-manual-payment
// ============================================================================
app.post('/api/billing/initiate-manual-payment', async (req, res) => {
  try {
    const { profile, error: authError } = await getRequestingProfile(req);
    if (authError) return res.status(401).json({ success: false, error: authError });
    if (!['manager', 'platform_admin'].includes(profile.role)) {
      return res.status(403).json({ success: false, error: 'Only Managers can manage billing.' });
    }

    const { plan, manual_reference, operator, phone } = req.body || {};
    if (!PLAN_PRICES[plan]) {
      return res.status(400).json({ success: false, error: 'Invalid plan selected.' });
    }
    if (!manual_reference || !manual_reference.trim()) {
      return res.status(400).json({ success: false, error: 'Please provide your payment reference/transaction ID.' });
    }

    const amount = PLAN_PRICES[plan];
    const reference = `vyeta-manual-${profile.organization_id}-${Date.now()}`;

    const { data: org } = await supabaseAdmin.from('organizations').select('name').eq('id', profile.organization_id).single();

    const vyetaTxRef = await createVyetaIntent({
      organizationId: profile.organization_id,
      organizationName: org?.name || 'Unknown',
      plan,
      amount,
      purpose: 'business_suite_subscription',
      extraMetadata: { payment_method: 'manual', manual_reference: manual_reference.trim() },
    });

    if (!vyetaTxRef) {
      return res.status(500).json({ success: false, error: 'Could not reach the payment ledger. Please try again shortly.' });
    }

    const { error: insertError } = await supabaseAdmin.from('subscription_payments').insert({
      organization_id: profile.organization_id,
      plan,
      amount,
      reference,
      phone: phone || null,
      operator: operator || null,
      status: 'pending',
      payment_method: 'manual',
      manual_reference: manual_reference.trim(),
      vyeta_tx_ref: vyetaTxRef,
    });
    if (insertError) {
      return res.status(500).json({ success: false, error: 'Could not record payment: ' + insertError.message });
    }

    return res.json({
      success: true,
      reference,
      message: 'Payment request submitted. Your plan will activate automatically once verified.',
    });
  } catch (err) {
    console.error('initiate-manual-payment error:', err);
    return res.status(500).json({ success: false, error: 'Unexpected server error while starting payment.' });
  }
});

// ============================================================================
// ENDPOINT 7: GET /api/billing/payment-status/:reference
// ============================================================================
app.get('/api/billing/payment-status/:reference', async (req, res) => {
  try {
    const { profile, error: authError } = await getRequestingProfile(req);
    if (authError) return res.status(401).json({ success: false, error: authError });

    const { reference } = req.params;
    const { data: payment, error } = await supabaseAdmin
      .from('subscription_payments')
      .select('*')
      .eq('reference', reference)
      .eq('organization_id', profile.organization_id)
      .single();

    if (error || !payment) {
      return res.status(404).json({ success: false, error: 'Payment record not found.' });
    }

    if (payment.status === 'pending' && payment.payment_method === 'lenco' && process.env.LENCO_API_KEY) {
      const lencoResult = await getCollectionStatusByReference(reference);
      const remoteStatus = lencoResult.data?.status;
      if (remoteStatus === 'successful' || remoteStatus === 'failed') {
        const newStatus = remoteStatus === 'successful' ? 'successful' : 'failed';
        await supabaseAdmin
          .from('subscription_payments')
          .update({ status: newStatus, completed_at: new Date().toISOString() })
          .eq('reference', reference);

        if (newStatus === 'successful') {
          await activateSubscription(profile.organization_id, payment.plan);
          await completeVyetaIntent(payment.vyeta_tx_ref, 'completed', reference);
        } else {
          await completeVyetaIntent(payment.vyeta_tx_ref, 'failed', reference, 'Lenco reported failure on poll');
        }
        return res.json({ success: true, status: newStatus });
      }
    }

    return res.json({ success: true, status: payment.status });
  } catch (err) {
    console.error('payment-status error:', err);
    return res.status(500).json({ success: false, error: 'Unexpected server error while checking payment status.' });
  }
});

// ============================================================================
// ENDPOINT 8: POST /api/webhooks/lenco
// ============================================================================
app.post('/api/webhooks/lenco', async (req, res) => {
  try {
    if (!process.env.LENCO_API_KEY) return res.status(500).send('Not configured');

    const webhookHashKey = crypto.createHash('sha256').update(process.env.LENCO_API_KEY).digest('hex');
    const expectedSignature = crypto
      .createHmac('sha512', webhookHashKey)
      .update(JSON.stringify(req.body))
      .digest('hex');

    if (expectedSignature !== req.headers['x-lenco-signature']) {
      return res.status(401).send('Invalid signature');
    }

    const { event, data } = req.body || {};
    if (!data?.reference) return res.status(200).send('Ignored (no reference)');

    if (event === 'collection.successful') {
      const { data: payment } = await supabaseAdmin
        .from('subscription_payments')
        .select('*')
        .eq('reference', data.reference)
        .single();

      if (payment && payment.status !== 'successful') {
        await supabaseAdmin
          .from('subscription_payments')
          .update({ status: 'successful', lenco_reference: data.lencoReference, completed_at: new Date().toISOString() })
          .eq('reference', data.reference);
        await activateSubscription(payment.organization_id, payment.plan);
        await completeVyetaIntent(payment.vyeta_tx_ref, 'completed', data.lencoReference);
      }
    } else if (event === 'collection.failed') {
      const { data: payment } = await supabaseAdmin
        .from('subscription_payments')
        .select('*')
        .eq('reference', data.reference)
        .single();

      await supabaseAdmin
        .from('subscription_payments')
        .update({ status: 'failed', lenco_reference: data.lencoReference })
        .eq('reference', data.reference);

      if (payment) {
        await completeVyetaIntent(payment.vyeta_tx_ref, 'failed', data.lencoReference, 'Lenco reported failure via webhook');
      }
    }

    return res.status(200).send('OK');
  } catch (err) {
    console.error('lenco webhook error:', err);
    return res.status(200).send('Error logged');
  }
});

// ============================================================================
// ENDPOINT 11: POST /api/webhooks/vyeta
// ============================================================================
app.post('/api/webhooks/vyeta', async (req, res) => {
  try {
    if (!VYETA_WEBHOOK_SECRET) return res.status(500).send('Not configured');

    const rawBody = JSON.stringify(req.body);
    const expectedSignature = crypto
      .createHmac('sha256', VYETA_WEBHOOK_SECRET.trim())
      .update(rawBody)
      .digest('hex');

    const providedSignature = req.headers['x-vyeta-signature'];
    if (providedSignature !== expectedSignature) {
      return res.status(401).send('Invalid signature');
    }

    const { tx_ref, status, metadata } = req.body || {};
    if (!tx_ref) return res.status(200).send('Ignored (no tx_ref)');

    const { data: payment } = await supabaseAdmin
      .from('subscription_payments')
      .select('*')
      .eq('vyeta_tx_ref', tx_ref)
      .single();

    if (!payment) return res.status(200).send('Ignored (no matching payment)');

    if (status === 'completed') {
      if (payment.status !== 'successful') {
        await supabaseAdmin
          .from('subscription_payments')
          .update({ status: 'successful', completed_at: new Date().toISOString() })
          .eq('vyeta_tx_ref', tx_ref);
        await activateSubscription(payment.organization_id, metadata?.plan || payment.plan);
      }
    } else if (status === 'failed') {
      await supabaseAdmin
        .from('subscription_payments')
        .update({ status: 'failed' })
        .eq('vyeta_tx_ref', tx_ref);
    }

    return res.status(200).send('OK');
  } catch (err) {
    console.error('vyeta webhook error:', err);
    return res.status(200).send('Error logged');
  }
});

// ---------------------------------------------------------------------------
async function requirePlatformAdmin(req, res) {
  const { profile, error } = await getRequestingProfile(req);
  if (error) {
    res.status(401).json({ success: false, error });
    return null;
  }
  if (profile.role !== 'platform_admin') {
    res.status(403).json({ success: false, error: 'Only Platform Admins can do this.' });
    return null;
  }
  return profile;
}

// ============================================================================
// ENDPOINT 4: GET /api/admin/pending-organizations
// ============================================================================
app.get('/api/admin/pending-organizations', async (req, res) => {
  const admin = await requirePlatformAdmin(req, res);
  if (!admin) return;

  try {
    const { data: orgs, error } = await supabaseAdmin
      .from('organizations')
      .select('id, name, phone, status, created_at')
      .eq('status', 'pending')
      .order('created_at', { ascending: true });

    if (error) return res.status(500).json({ success: false, error: error.message });

    const orgsWithManager = await Promise.all(
      orgs.map(async (org) => {
        const { data: profile } = await supabaseAdmin
          .from('profiles')
          .select('full_name, id')
          .eq('organization_id', org.id)
          .eq('role', 'manager')
          .limit(1)
          .maybeSingle();

        let email = null;
        if (profile?.id) {
          const { data: userData } = await supabaseAdmin.auth.admin.getUserById(profile.id);
          email = userData?.user?.email || null;
        }

        return { ...org, managerName: profile?.full_name || 'Unknown', managerEmail: email };
      })
    );

    return res.json({ success: true, organizations: orgsWithManager });
  } catch (err) {
    console.error('pending-organizations error:', err);
    return res.status(500).json({ success: false, error: 'Unexpected server error while listing pending businesses.' });
  }
});

// ============================================================================
// ENDPOINT 5: POST /api/admin/approve-organization
// ============================================================================
app.post('/api/admin/approve-organization', async (req, res) => {
  const admin = await requirePlatformAdmin(req, res);
  if (!admin) return;

  try {
    const { organizationId, approve } = req.body || {};
    if (!organizationId || typeof approve !== 'boolean') {
      return res.status(400).json({ success: false, error: 'organizationId and approve (true/false) are required.' });
    }

    const newStatus = approve ? 'active' : 'suspended';
    const { error } = await supabaseAdmin.from('organizations').update({ status: newStatus }).eq('id', organizationId);

    if (error) return res.status(500).json({ success: false, error: error.message });

    return res.json({ success: true, status: newStatus });
  } catch (err) {
    console.error('approve-organization error:', err);
    return res.status(500).json({ success: false, error: 'Unexpected server error while updating business status.' });
  }
});

// ============================================================================
// ENDPOINT 9: GET /api/admin/organizations
// ============================================================================
app.get('/api/admin/organizations', async (req, res) => {
  const admin = await requirePlatformAdmin(req, res);
  if (!admin) return;

  try {
    const { data: orgs, error } = await supabaseAdmin
      .from('organizations')
      .select('id, name, status, plan, subscription_status, trial_ends_at, current_period_end, created_at')
      .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ success: false, error: error.message });

    return res.json({ success: true, organizations: orgs });
  } catch (err) {
    console.error('admin/organizations error:', err);
    return res.status(500).json({ success: false, error: 'Unexpected server error while listing businesses.' });
  }
});

// ============================================================================
// ENDPOINT 10: GET /api/admin/subscription-payments
// ============================================================================
app.get('/api/admin/subscription-payments', async (req, res) => {
  const admin = await requirePlatformAdmin(req, res);
  if (!admin) return;

  try {
    const { data: payments, error } = await supabaseAdmin
      .from('subscription_payments')
      .select('id, organization_id, plan, amount, reference, status, phone, operator, payment_method, manual_reference, vyeta_tx_ref, created_at, completed_at')
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) return res.status(500).json({ success: false, error: error.message });

    const orgIds = [...new Set(payments.map((p) => p.organization_id))];
    const { data: orgs } = await supabaseAdmin.from('organizations').select('id, name').in('id', orgIds);
    const orgNameById = Object.fromEntries((orgs || []).map((o) => [o.id, o.name]));

    return res.json({
      success: true,
      payments: payments.map((p) => ({ ...p, organizationName: orgNameById[p.organization_id] || 'Unknown' }))
    });
  } catch (err) {
    console.error('admin/subscription-payments error:', err);
    return res.status(500).json({ success: false, error: 'Unexpected server error while listing payments.' });
  }
});

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
