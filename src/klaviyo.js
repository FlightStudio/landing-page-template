import {
  KLAVIYO_COMPANY_ID,
  KLAVIYO_LIST_ID,
  CONSENT_SOURCE,
  CAMPAIGN_SLUG,
  CAMPAIGN_NAME,
} from "./campaign.config";

/**
 * Normalise a phone number to E.164 format.
 * @param {string} raw - User-entered phone number
 * @param {string} dialCode - Country dial code including "+" (e.g. "+44")
 * Returns null if the result doesn't look valid.
 */
// Expected national digit lengths (after removing leading 0, before adding dial code)
const NATIONAL_LENGTHS = {
  "+44": [10],       // UK: 07XXX XXXXXX
  "+1": [10],        // US/CA: (XXX) XXX-XXXX
  "+353": [9],       // IE: 08X XXX XXXX
  "+61": [9],        // AU: 04XX XXX XXX
  "+64": [8, 9],     // NZ: 02X XXX XXXX or 02XX XXX XXXX
  "+91": [10],       // IN: XXXXX XXXXX
  "+49": [10, 11],   // DE: varies
  "+33": [9],        // FR: 06 XX XX XX XX
  "+34": [9],        // ES: 6XX XXX XXX
  "+39": [9, 10],    // IT: 3XX XXX XXXX
  "+31": [9],        // NL: 06 XXXX XXXX
  "+46": [9],        // SE
  "+47": [8],        // NO
  "+45": [8],        // DK
  "+358": [9, 10],   // FI
  "+48": [9],        // PL
  "+41": [9],        // CH
  "+43": [10, 11],   // AT
  "+32": [9],        // BE
  "+351": [9],       // PT
  "+30": [10],       // GR
  "+90": [10],       // TR
  "+971": [9],       // AE
  "+966": [9],       // SA
  "+27": [9],        // ZA
  "+234": [10],      // NG
  "+254": [9],       // KE
  "+55": [10, 11],   // BR
  "+52": [10],       // MX
  "+81": [10],       // JP
  "+82": [10],       // KR
  "+86": [11],       // CN
  "+65": [8],        // SG
  "+60": [9, 10],    // MY
  "+63": [10],       // PH
  "+66": [9],        // TH
  "+852": [8],       // HK
  "+62": [10, 12],   // ID
};

export function normalisePhone(raw, dialCode) {
  // Strip spaces, dashes, brackets
  let digits = raw.replace(/[\s\-().]/g, "");
  // If user typed with a leading +, use as-is
  if (digits.startsWith("+")) {
    // already has country code
  } else {
    // Strip leading 0 (local format) then prepend dial code
    if (digits.startsWith("0")) {
      digits = digits.slice(1);
    }
    digits = dialCode + digits;
  }
  // Must be + followed by digits
  if (!/^\+\d{7,15}$/.test(digits)) {
    return null;
  }
  // Check national length matches expected for this country
  const nationalDigits = digits.slice(dialCode.length);
  const expected = NATIONAL_LENGTHS[dialCode];
  if (expected && !expected.includes(nationalDigits.length)) {
    return null;
  }
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
