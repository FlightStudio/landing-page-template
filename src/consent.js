import Cookies from "js-cookie";
import {
  KLAVIYO_COMPANY_ID,
  CAMPAIGN_SLUG,
  CAMPAIGN_NAME,
  PAGE_TITLE,
  META_PIXEL_ID,
  RUDDERSTACK_WRITE_KEY,
  RUDDERSTACK_DATAPLANE_URL,
} from "./campaign.config";

const COOKIE_NAME = "cookie_consent";

export function getConsent() {
  const raw = Cookies.get(COOKIE_NAME);
  if (!raw) return undefined;
  return raw.split(":")[0]; // "accepted" | "rejected"
}

export function setConsent(value) {
  const ts = new Date().toISOString();
  Cookies.set(COOKIE_NAME, `${value}:${ts}`, { expires: 365 });
}

let klaviyoLoaded = false;
let rudderSDKLoaded = false;
let rudderTrackingLoaded = false;
let metaPixelLoaded = false;

export function loadKlaviyo() {
  if (klaviyoLoaded) return;
  klaviyoLoaded = true;
  const s = document.createElement("script");
  s.async = true;
  s.src = `https://static.klaviyo.com/onsite/js/klaviyo.js?company_id=${KLAVIYO_COMPANY_ID}`;
  document.head.appendChild(s);
}

/**
 * Load Meta Pixel in granted mode — fires PageView immediately.
 * No consent gating; data controller approved unconditional loading.
 */
export function loadMetaPixel() {
  if (metaPixelLoaded || !META_PIXEL_ID) return;
  metaPixelLoaded = true;
  !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){
  n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};
  if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];
  t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];
  s.parentNode.insertBefore(t,s)}(window,document,'script',
  'https://connect.facebook.net/en_US/fbevents.js');
  window.fbq('init', META_PIXEL_ID);
  window.fbq('track', 'PageView');
}

/**
 * Load just the RudderStack SDK — no page views or click tracking.
 * Safe to call without cookie consent (for form submission tracking).
 */
export function ensureRudderStackSDK() {
  if (rudderSDKLoaded) return;
  rudderSDKLoaded = true;

  const writeKey = RUDDERSTACK_WRITE_KEY;
  const dataplaneUrl = RUDDERSTACK_DATAPLANE_URL;

  // Inline the SDK snippet
  !function(){"use strict";window.RudderSnippetVersion="3.2.0";var e="rudderanalytics";window[e]||(window[e]=[]);
  var rudderanalytics=window[e];if(Array.isArray(rudderanalytics)){
  if(true===rudderanalytics.snippetExecuted&&window.console&&console.error){
  console.error("RudderStack JavaScript SDK snippet included more than once.")}else{rudderanalytics.snippetExecuted=true,
  window.rudderAnalyticsBuildType="legacy";var sdkBaseUrl="https://cdn.rudderlabs.com";var sdkVersion="v3";
  var sdkFileName="rsa.min.js";var scriptLoadingMode="async";
  var r=["setDefaultInstanceKey","load","ready","page","track","identify","alias","group","reset","setAnonymousId","startSession","endSession","consent","addCustomIntegration"];
  for(var n=0;n<r.length;n++){var t=r[n];rudderanalytics[t]=function(r){return function(){var n;
  Array.isArray(window[e])?rudderanalytics.push([r].concat(Array.prototype.slice.call(arguments))):null===(n=window[e][r])||void 0===n||n.apply(window[e],arguments)
  }}(t)}try{
  new Function('class Test{field=()=>{};test({prop=[]}={}){return prop?(prop?.property??[...prop]):import("");}}'),
  window.rudderAnalyticsBuildType="modern"}catch(i){}var d=document.head||document.getElementsByTagName("head")[0];
  var o=document.body||document.getElementsByTagName("body")[0];window.rudderAnalyticsAddScript=function(e,r,n){
  var t=document.createElement("script");t.src=e,t.setAttribute("data-loader","RS_JS_SDK"),r&&n&&t.setAttribute(r,n),
  "async"===scriptLoadingMode?t.async=true:"defer"===scriptLoadingMode&&(t.defer=true),
  d?d.insertBefore(t,d.firstChild):o.insertBefore(t,o.firstChild)},window.rudderAnalyticsMount=function(){!function(){
  if("undefined"==typeof globalThis){var e;var r=function getGlobal(){
  return"undefined"!=typeof self?self:"undefined"!=typeof window?window:null}();r&&Object.defineProperty(r,"globalThis",{
  value:r,configurable:true})}
  }(),window.rudderAnalyticsAddScript("".concat(sdkBaseUrl,"/").concat(sdkVersion,"/").concat(window.rudderAnalyticsBuildType,"/").concat(sdkFileName),"data-rsa-write-key",writeKey)
  },
  "undefined"==typeof Promise||"undefined"==typeof globalThis?window.rudderAnalyticsAddScript("https://polyfill-fastly.io/v3/polyfill.min.js?version=3.111.0&features=Symbol%2CPromise&callback=rudderAnalyticsMount"):window.rudderAnalyticsMount();
  var loadOptions={};rudderanalytics.load(writeKey,dataplaneUrl,loadOptions);
  }}}();
}

/**
 * Load full RudderStack tracking (page views + click tracking).
 */
export function loadRudderStackTracking() {
  ensureRudderStackSDK();

  if (rudderTrackingLoaded) return;
  rudderTrackingLoaded = true;

  // Variant-aware page view
  window.rudderanalytics.ready(function() {
    var urlParams = new URLSearchParams(window.location.search);
    var variant = urlParams.get("variant") || "unknown";
    window.rudderanalytics.page(PAGE_TITLE, {
      landing_page: CAMPAIGN_SLUG,
      variant: variant,
      campaign: CAMPAIGN_NAME,
    });
  });

  // Autotrack clicks
  document.body.addEventListener(
    "click",
    function (e) {
      var target = e.target;
      while (
        target &&
        target.tagName !== "A" &&
        target.tagName !== "BUTTON" &&
        target !== document.body
      ) {
        target = target.parentElement;
      }
      if (target && (target.tagName === "A" || target.tagName === "BUTTON")) {
        window.rudderanalytics.track("Element Clicked", {
          tag: target.tagName,
          text: target.innerText || target.textContent || "No Text",
          id: target.id || "no-id",
          classes: target.className || "no-classes",
          href: target.href || "",
          page_url: window.location.href,
        });
      }
    },
    true
  );
}

/**
 * Full RudderStack load (SDK + tracking).
 */
export function loadRudderStack() {
  loadRudderStackTracking();
}

/** Boot all scripts on app init — no consent gating */
export function initConsent() {
  loadKlaviyo();
  loadMetaPixel();
  loadRudderStack();
}
