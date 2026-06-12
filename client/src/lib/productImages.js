import bajaraFlourImage from "../assets/spice-root/Bajara Flour.png";
import besanImage from "../assets/spice-root/Besan.png";
import chanaDalImage from "../assets/spice-root/Chana Dal.png";
import garamMasalaImage from "../assets/spice-root/Garam Masala.png";
import jowarFlourImage from "../assets/spice-root/Jowar Flour.png";
import lahsunMirchiImage from "../assets/spice-root/Lahsun Mirchi Powder.png";
import mirchiImage from "../assets/spice-root/Mirchi Powder.png";
import nachaniFlourImage from "../assets/spice-root/Nachani Flour.png";
import pohaImage from "../assets/spice-root/Poha.png";
import turmericAromaticImage from "../assets/spice-root/Turmeric Powder (Aromatic).png";
import turmericImage from "../assets/spice-root/Turmeric Powder.png";

const PRODUCT_IMAGE_LOOKUP = {
  "bajara-flour": bajaraFlourImage,
  "bajra-flour": bajaraFlourImage,
  besan: besanImage,
  "chana-dal": chanaDalImage,
  "garam-masala": garamMasalaImage,
  "jowar-flour": jowarFlourImage,
  "lahsun-mirchi-masala": lahsunMirchiImage,
  "lahsun-mirchi-powder": lahsunMirchiImage,
  "mirchi-powder": mirchiImage,
  "nachani-flour": nachaniFlourImage,
  poha: pohaImage,
  "turmeric-aromatic": turmericAromaticImage,
  "turmeric-colour": turmericImage,
  "turmeric-color": turmericImage,
  "turmeric-colour-aromatic": turmericAromaticImage,
  "turmeric-color-aromatic": turmericAromaticImage,
};

export function resolveProductImage(productId = "", productName = "", fallbackImage = "") {
  const trimmedFallback = String(fallbackImage || "").trim();

  if (/^https?:\/\//i.test(trimmedFallback)) {
    return trimmedFallback;
  }

  const normalizedId = String(productId).trim().toLowerCase();
  const normalizedName = String(productName)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  return PRODUCT_IMAGE_LOOKUP[normalizedId] || PRODUCT_IMAGE_LOOKUP[normalizedName] || fallbackImage || mirchiImage;
}

export const featuredProductImages = {
  mirchi: mirchiImage,
  turmeric: turmericImage,
  turmericAromatic: turmericAromaticImage,
  garamMasala: garamMasalaImage,
  lahsunMirchi: lahsunMirchiImage,
  besan: besanImage,
  chanaDal: chanaDalImage,
  poha: pohaImage,
};
