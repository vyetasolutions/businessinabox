// ============================================================================
// LENCO API CLIENT
// ============================================================================
// Thin wrapper around Lenco's v2 Collections API for mobile money payments.
// Docs: https://lenco-api.readme.io/v2.0/reference
// ============================================================================

const LENCO_BASE_URL = 'https://api.lenco.co/access/v2';

function authHeaders() {
  return {
    Authorization: `Bearer ${process.env.LENCO_API_KEY}`,
    'Content-Type': 'application/json'
  };
}

/**
 * Initiates a mobile money collection (charges the business's phone).
 * operator must be one of: mtn, airtel, zamtel (Zambia).
 */
async function initiateMobileMoneyCollection({ amount, reference, phone, operator }) {
  const res = await fetch(`${LENCO_BASE_URL}/collections/mobile-money`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      amount,
      reference,
      phone,
      operator,
      country: 'zm',
      bearer: 'merchant' // Vyeta absorbs the Lenco fee, not the paying business
    })
  });
  const data = await res.json();
  return { httpOk: res.ok, ...data };
}

/**
 * Re-queries a collection's status by reference — used as a fallback if the
 * webhook is delayed or the browser is polling while waiting for the
 * customer to authorize on their phone.
 */
async function getCollectionStatusByReference(reference) {
  const res = await fetch(`${LENCO_BASE_URL}/collections/status/${encodeURIComponent(reference)}`, {
    method: 'GET',
    headers: authHeaders()
  });
  const data = await res.json();
  return { httpOk: res.ok, ...data };
}

module.exports = { initiateMobileMoneyCollection, getCollectionStatusByReference };
