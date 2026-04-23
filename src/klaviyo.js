import {
  KLAVIYO_COMPANY_ID,
  KLAVIYO_LIST_ID,
  CONSENT_SOURCE,
  CAMPAIGN_SLUG,
  CAMPAIGN_NAME,
} from "./campaign.config";

const NATIONAL_LENGTHS = {
  "+44": [10], "+1": [10], "+353": [9], "+61": [9], "+64": [8, 9],
  "+91": [10], "+49": [10, 11], "+33": [9], "+34": [9], "+39": [9, 10],
  "+31": [9], "+46": [9], "+47": [8], "+45": [8], "+358": [9, 10],
  "+48": [9], "+41": [9], "+43": [10, 11], "+32": [9], "+351": [9],
  "+30": [10], "+90": [10], "+971": [9], "+966": [9], "+27": [9],
  "+234": [10], "+254": [9], "+55": [10, 11], "+52": [10], "+81": [10],
  "+82": [10], "+86": [11], "+65": [8], "+60": [9, 10], "+63": [10],
  "+66": [9], "+852": [8], "+62": [10, 12],
};

/**
 * Normalise a phone number to E.164 format.
 * @param {string} raw - User-entered phone number
 * @param {string} dialCode - Country dial code including "+" (e.g. "+44")
 * Returns null if the result doesn't look valid.
 */
export function normalisePhone(raw, dialCode) {
  let digits = raw.replace(/[\s\-().]/g, "");
  if (digits.startsWith("+")) {
    // already has country code
  } else {
    if (digits.startsWith("0")) digits = digits.slice(1);
    digits = dialCode + digits;
  }
  if (!/^\+\d{7,15}$/.test(digits)) return null;
  const nationalDigits = digits.slice(dialCode.length);
  const expected = NATIONAL_LENGTHS[dialCode];
  if (expected && !expected.includes(nationalDigits.length)) return null;
  return digits;
}

/**
 * Subscribe a profile to the Klaviyo list via the Client API.
 * Handles email subscription, and optionally SMS if phone is provided.
 * Returns the fetch Response (202 = success).
 */
export async function subscribeToKlaviyo({ email, firstName, phone, variant }) {
  const sourceUrl = window.location.href;

  const subscriptions = {
    email: {
      marketing: { consent: "SUBSCRIBED" },
    },
  };

  if (phone) {
    subscriptions.sms = {
      marketing: { consent: "SUBSCRIBED" },
      transactional: { consent: "SUBSCRIBED" },
    };
    subscriptions.whatsapp = {
      marketing: { consent: "SUBSCRIBED" },
      transactional: { consent: "SUBSCRIBED" },
    };
  }

  const profileAttributes = {
    email,
    first_name: firstName,
    subscriptions,
    properties: {
      consent_source: CONSENT_SOURCE,
      landing_page: CAMPAIGN_SLUG,
      [`${CAMPAIGN_SLUG}_variant`]: variant,
      campaign: CAMPAIGN_NAME,
      source_url: sourceUrl,
    },
  };

  // Only include phone if provided
  if (phone) {
    profileAttributes.phone_number = phone;
  }

  const res = await fetch(`https://a.klaviyo.com/client/subscriptions/?company_id=${KLAVIYO_COMPANY_ID}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/vnd.api+json",
      Revision: "2026-01-15",
    },
    body: JSON.stringify({
      data: {
        type: "subscription",
        attributes: {
          custom_source: CONSENT_SOURCE,
          profile: {
            data: {
              type: "profile",
              attributes: profileAttributes,
            },
          },
        },
        relationships: {
          list: {
            data: {
              type: "list",
              id: KLAVIYO_LIST_ID,
            },
          },
        },
      },
    }),
  });

  return res;
}

/**
 * Identify the profile in Klaviyo's onsite tracking (if the JS snippet is loaded).
 */
export function identifyKlaviyo({ email, firstName, phone, variant }, extraProperties = {}) {
  const identity = {
    $email: email,
    $first_name: firstName,
    landing_page: CAMPAIGN_SLUG,
    [`${CAMPAIGN_SLUG}_variant`]: variant,
    ...extraProperties,
  };
  if (phone) {
    identity.$phone_number = phone;
  }
  window._learnq?.push(["identify", identity]);
}

/**
 * Update a profile's custom properties via the Klaviyo Client API.
 * Unlike identifyKlaviyo, this does NOT depend on the onsite JS snippet
 * being loaded — it hits the API directly, so it works regardless of
 * cookie consent state.
 */
export async function updateKlaviyoProfile(email, properties) {
  return fetch(`https://a.klaviyo.com/client/profiles/?company_id=${KLAVIYO_COMPANY_ID}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/vnd.api+json",
      Revision: "2026-01-15",
    },
    body: JSON.stringify({
      data: {
        type: "profile",
        attributes: {
          email,
          properties,
        },
      },
    }),
  });
}
