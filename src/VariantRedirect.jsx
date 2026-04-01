import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Cookies from "js-cookie";
import { VARIANTS, CAMPAIGN_SLUG } from "./campaign.config";

const COOKIE_NAME = `${CAMPAIGN_SLUG}_variant`;

export default function VariantRedirect() {
  const navigate = useNavigate();

  useEffect(() => {
    let variant = Cookies.get(COOKIE_NAME);

    if (!variant) {
      // Equal-weight random split across all configured variants
      variant = VARIANTS[Math.floor(Math.random() * VARIANTS.length)];
      Cookies.set(COOKIE_NAME, variant, { expires: 365 });
    }

    navigate(`/${variant}?variant=${variant}`, { replace: true });
  }, [navigate]);

  return null;
}
