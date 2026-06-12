import {
  collection,
  doc,
  getDocs,
  serverTimestamp as firestoreServerTimestamp,
  writeBatch,
} from "firebase/firestore";
import { db } from "../firebase";
import { subscribeSafely } from "./firestoreSubscriptions";
import { resolveProductImage } from "./productImages";

const currencyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

const CATALOG_STORAGE_KEY = "spice-root-catalog-v2";
const PRODUCTS_COLLECTION = "products";
const SIZE_CONFIG = [
  { key: "1kg", label: "1 KG", multiplier: 1, discountPercent: 0 },
  { key: "3kg", label: "3 KG", multiplier: 3, discountPercent: 5 },
  { key: "5kg", label: "5 KG", multiplier: 5, discountPercent: 10 },
];

let catalogCache = readCatalogFromStorage();

const fallbackCatalogPayload = [
  {
    id: "mirchi-powder",
    name: "Mirchi Powder",
    price: 550,
    category: "Masala",
    image: "/images/mirchi.png",
    unit: "1 KG",
    featured: true,
    description: "Bold red chilli powder with clean heat and rich color for curries and tadkas.",
    story: "Ground for vibrant color, fast aroma release, and a fiery finish that stays clean on the palate.",
    rating: 4.9,
    ratingCount: 201,
    highlights: ["Organic and high quality", "Robust spice-forward flavor", "Farm fresh sourced"],
  },
  {
    id: "lahsun-mirchi-masala",
    name: "Lahsun Mirchi Masala",
    price: 600,
    category: "Masala",
    image: "/images/lahsun.png",
    unit: "1 KG",
    featured: true,
    description: "Garlic-forward spice blend with smoky punch, perfect for fries and stir-fry.",
    story: "A fast flavor booster built for chutneys, stir-fry, fries, and any dish that needs a garlicky kick.",
    rating: 4.8,
    ratingCount: 168,
    highlights: ["Smoky and savory profile", "Balanced chilli heat", "Ideal for quick everyday cooking"],
  },
  {
    id: "turmeric-colour",
    name: "Turmeric Powder (Colour)",
    price: 300,
    category: "Masala",
    image: "/images/haldi.png",
    unit: "1 KG",
    featured: true,
    description: "Bright turmeric for vibrant color in dals, curries, and daily cooking.",
    story: "Designed for vivid golden tones and dependable daily use across Indian home kitchens.",
    rating: 4.9,
    ratingCount: 142,
    highlights: ["Strong natural color", "Clean earthy aroma", "Great for curries and tadkas"],
  },
  {
    id: "turmeric-aromatic",
    name: "Turmeric Powder (Aromatic)",
    price: 320,
    category: "Masala",
    image: "/images/haldi.png",
    unit: "1 KG",
    featured: true,
    description: "Aromatic haldi with warm earthy notes, crafted for premium home kitchens.",
    story: "A softer fragrant turmeric that layers warmth into sabzis, dals, and milk blends.",
    rating: 4.7,
    ratingCount: 119,
    highlights: ["Earthy warm aroma", "Smooth daily cooking finish", "Premium kitchen staple"],
  },
  {
    id: "turmeric-colour-aromatic",
    name: "Turmeric Powder (Colour + Aromatic)",
    price: 350,
    category: "Masala",
    image: "/images/haldi.png",
    unit: "1 KG",
    featured: false,
    description: "Balanced turmeric combining deep aroma and bold golden color.",
    story: "Built for cooks who want both visual richness and a warmer aromatic finish in one blend.",
    rating: 4.8,
    ratingCount: 97,
    highlights: ["Balanced aroma and color", "Smooth pantry essential", "Versatile for everyday meals"],
  },
  {
    id: "garam-masala",
    name: "Garam Masala",
    price: 450,
    category: "Masala",
    image: "/images/garam.png",
    unit: "1 KG",
    featured: false,
    description: "Layered whole-spice blend that adds warmth and complexity to rich gravies.",
    story: "A rounded finishing masala with toasted whole-spice depth made for richer dinner dishes.",
    rating: 4.9,
    ratingCount: 184,
    highlights: ["Warm and layered finish", "Ideal for gravies and pulao", "Deep whole-spice character"],
  },
  {
    id: "besan",
    name: "Besan",
    price: 200,
    category: "Flour",
    image: "/images/besan.png",
    unit: "1 KG",
    featured: false,
    description: "Fine gram flour for crispy pakoras, laddoos, and smooth batters.",
    story: "Smooth and nutty gram flour that performs beautifully in both savory and sweet recipes.",
    rating: 4.8,
    ratingCount: 123,
    highlights: ["Fine clean milling", "Great for batters and sweets", "Consistent kitchen texture"],
  },
  {
    id: "rice-flour",
    name: "Rice Flour",
    price: 50,
    category: "Flour",
    image: "/images/rice.png",
    unit: "1 KG",
    featured: false,
    description: "Light rice flour suited for snacks, coatings, and gluten-light recipes.",
    story: "A lighter flour option with crisp performance in coating, snack, and breakfast preparations.",
    rating: 4.6,
    ratingCount: 73,
    highlights: ["Light crisp texture", "Useful for snacks and batters", "Smooth pantry basic"],
  },
  {
    id: "wheat-flour",
    name: "Wheat Flour",
    price: 80,
    category: "Flour",
    image: "/images/wheat.png",
    unit: "1 KG",
    featured: false,
    description: "Everyday wheat flour with dependable texture for soft and fluffy rotis.",
    story: "Stone-milled style everyday atta made for softness, stretch, and dependable roti texture.",
    rating: 4.7,
    ratingCount: 89,
    highlights: ["Soft everyday rotis", "Dependable dough strength", "Clean staple pantry base"],
  },
  {
    id: "bajara-flour",
    name: "Bajara Flour",
    price: 100,
    category: "Flour",
    image: "/images/bajara.png",
    unit: "1 KG",
    featured: false,
    description: "Nutty millet flour ideal for rustic rotlas and wholesome meal prep.",
    story: "A richer millet flour with rustic body and a warm nutty finish for traditional flatbreads.",
    rating: 4.6,
    ratingCount: 58,
    highlights: ["Rustic millet flavor", "Wholesome meal support", "Traditional kitchen favorite"],
  },
  {
    id: "jowar-flour",
    name: "Jowar Flour",
    price: 120,
    category: "Flour",
    image: "/images/jowar.png",
    unit: "1 KG",
    featured: false,
    description: "Sorghum flour with clean taste and soft bite for traditional flatbreads.",
    story: "Clean sorghum flour with soft bite and a subtle grain note for lighter traditional breads.",
    rating: 4.7,
    ratingCount: 61,
    highlights: ["Soft flatbread texture", "Clean sorghum taste", "Reliable everyday flour"],
  },
  {
    id: "nachani-flour",
    name: "Nachani Flour",
    price: 140,
    category: "Flour",
    image: "/images/nachani.png",
    unit: "1 KG",
    featured: false,
    description: "Ragi flour rich in nutrition, perfect for bhakri, porridges, and snacks.",
    story: "A nutrient-rich ragi flour with earthy depth for wholesome breakfasts and traditional meals.",
    rating: 4.8,
    ratingCount: 70,
    highlights: ["Ragi-rich nutrition", "Ideal for bhakri and porridge", "Earthy wholesome flavor"],
  },
  {
    id: "poha",
    name: "Poha",
    price: 120,
    category: "Pantry",
    image: "/images/poha.png",
    unit: "1 KG",
    featured: false,
    description: "Flattened rice flakes with light texture for quick breakfasts and snack mixes.",
    story: "Soft-flake poha made for quick breakfasts, chivda, and pantry convenience without losing texture.",
    rating: 4.7,
    ratingCount: 64,
    highlights: ["Quick breakfast favorite", "Light and soft flakes", "Great for snack mixes"],
  },
  {
    id: "chana-dal",
    name: "Chana Dal",
    price: 150,
    category: "Pantry",
    image: "/images/chana-dal.png",
    unit: "1 KG",
    featured: false,
    description: "Clean split Bengal gram for dal, farsan, tempering, and snack prep.",
    story: "A pantry essential with satisfying bite and dependable quality for savory cooking and snacks.",
    rating: 4.8,
    ratingCount: 77,
    highlights: ["Clean split gram quality", "Versatile pantry use", "Excellent texture after cooking"],
  },
];

function roundPrice(value) {
  return Math.round(Number(value) || 0);
}

export function slugify(value = "") {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function normalizeSizeKey(value = "") {
  return String(value).trim().toLowerCase().replace(/\s+/g, "");
}

function buildDefaultTier(config, basePrice) {
  const originalPrice = roundPrice(basePrice * config.multiplier);
  const discountedPrice = config.discountPercent
    ? roundPrice(originalPrice * (1 - config.discountPercent / 100))
    : originalPrice;

  return {
    key: config.key,
    label: config.label,
    size: config.label,
    price: discountedPrice,
    originalPrice: config.discountPercent ? originalPrice : discountedPrice,
    discountPercent: config.discountPercent,
    hasDiscount: config.discountPercent > 0 && discountedPrice < originalPrice,
  };
}

function normalizePriceTiers(basePrice, rawTiers = []) {
  const lookup = new Map(
    Array.isArray(rawTiers)
      ? rawTiers
          .filter(Boolean)
          .map((tier) => [
            normalizeSizeKey(tier.key || tier.size || tier.label),
            tier,
          ])
      : []
  );

  return SIZE_CONFIG.map((config) => {
    const fallbackTier = buildDefaultTier(config, basePrice);
    const rawTier =
      lookup.get(normalizeSizeKey(config.key)) ||
      lookup.get(normalizeSizeKey(config.label));

    if (!rawTier) {
      return fallbackTier;
    }

    const originalPrice = roundPrice(
      rawTier.originalPrice ??
        rawTier.compareAtPrice ??
        rawTier.mrp ??
        fallbackTier.originalPrice
    );
    const price = roundPrice(
      rawTier.discountPrice ?? rawTier.salePrice ?? rawTier.price ?? fallbackTier.price
    );
    const hasDiscount = price > 0 && originalPrice > price;
    const discountPercent = hasDiscount
      ? roundPrice(
          rawTier.discountPercent ??
            ((originalPrice - price) / originalPrice) * 100
        )
      : 0;

    return {
      key: config.key,
      label: config.label,
      size: config.label,
      price: price || fallbackTier.price,
      originalPrice: hasDiscount ? originalPrice : price || fallbackTier.price,
      discountPercent,
      hasDiscount,
    };
  });
}

function normalizeHighlights(value) {
  if (Array.isArray(value) && value.length > 0) {
    return value.filter(Boolean);
  }

  return ["Premium quality", "Freshly packed", "Crafted for modern kitchens"];
}

function createNormalizedProduct(item) {
  const name = item.productName || item.name || "";
  const id = item.slug || item.id || slugify(name);
  const basePrice = roundPrice(item.basePrice ?? item.price);
  const priceTiers = normalizePriceTiers(
    basePrice,
    item.priceTiers || item.pricing || item.sizeOptions
  );

  return {
    id,
    slug: id,
    documentId: item.documentId || item.id || id,
    name,
    image: resolveProductImage(id, name, item.imageUrl || item.image),
    price: priceTiers[0]?.price || basePrice,
    basePrice,
    category: item.category || "Pantry",
    unit: item.unit || "1 KG",
    description: item.description || "Premium pantry essential.",
    story: item.story || item.description || "Premium pantry essential.",
    ingredients: item.ingredients || "",
    rating: Number(item.rating) || 4.8,
    ratingCount: Number(item.ratingCount) || 100,
    priceTiers,
    sizes: priceTiers.map((tier) => tier.label),
    highlights: normalizeHighlights(item.highlights),
    featured: Boolean(item.featured),
    stock: Number(item.stock) || 0,
    status: item.status || "Active",
    sku: item.sku || "",
    reorderLevel: Number(item.reorderLevel) || 0,
  };
}

function normalizeCatalog(payload) {
  if (!Array.isArray(payload)) {
    return [];
  }

  return payload
    .filter((item) => item && (item.productName || item.name) && (item.imageUrl || item.image))
    .map(createNormalizedProduct);
}

function readCatalogFromStorage() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const cachedCatalog = window.sessionStorage.getItem(CATALOG_STORAGE_KEY);

    if (!cachedCatalog) {
      return null;
    }

    return normalizeCatalog(JSON.parse(cachedCatalog));
  } catch {
    return null;
  }
}

function writeCatalogToStorage(catalog) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.setItem(CATALOG_STORAGE_KEY, JSON.stringify(catalog));
  } catch {
    // Ignore storage failures and continue with in-memory cache.
  }
}

export const fallbackCatalog = normalizeCatalog(fallbackCatalogPayload);

export function normalizeFirestoreProduct(item) {
  if (!item) {
    return null;
  }

  const name = item.productName || item.name || "";
  const firestoreId = item.id;
  const stableId = item.slug || slugify(name) || firestoreId;

  return createNormalizedProduct({
    ...item,
    id: stableId,
    slug: stableId,
    documentId: firestoreId,
  });
}

export function findProductByRouteParam(products, productId) {
  const normalizedId = String(productId || "").trim().toLowerCase();
  
  return (products || []).find(
    (item) =>
      String(item.id || "").toLowerCase() === normalizedId ||
      String(item.slug || "").toLowerCase() === normalizedId ||
      String(item.documentId || "").toLowerCase() === normalizedId
  );
}

export function subscribeToCatalog(onCatalog, onError) {
  if (catalogCache) {
    onCatalog(catalogCache);
  }

  return subscribeSafely(
    collection(db, PRODUCTS_COLLECTION),
    (snapshot) => {
      const firestoreCatalog = snapshot.empty
        ? []
        : snapshot.docs
            .map((item) => normalizeFirestoreProduct({ id: item.id, ...item.data() }))
            .filter(Boolean);
      const catalog = firestoreCatalog.length > 0 ? firestoreCatalog : fallbackCatalog;

      catalogCache = catalog;
      writeCatalogToStorage(catalog);
      onCatalog(catalog);
    },
    (error) => {
      if (onError) {
        onError(error);
      }
    }
  );
}

function serializePriceTier(tier) {
  return {
    key: tier.key,
    label: tier.label,
    size: tier.size,
    price: tier.price,
    originalPrice: tier.originalPrice,
    discountPercent: tier.discountPercent,
    hasDiscount: tier.hasDiscount,
  };
}

export function serializeProductForFirestore(product) {
  return {
    slug: product.slug || product.id || slugify(product.name),
    productName: product.name,
    category: product.category,
    price: roundPrice(product.basePrice ?? product.price),
    basePrice: roundPrice(product.basePrice ?? product.price),
    stock: Number(product.stock) || 0,
    description: product.description || "",
    story: product.story || product.description || "",
    ingredients: product.ingredients || "",
    status: product.status || "Active",
    imageUrl: product.image || "",
    unit: product.unit || "1 KG",
    featured: Boolean(product.featured),
    rating: Number(product.rating) || 4.8,
    ratingCount: Number(product.ratingCount) || 100,
    sku: product.sku || "",
    reorderLevel: Number(product.reorderLevel) || 0,
    highlights: normalizeHighlights(product.highlights),
    sizes: SIZE_CONFIG.map((item) => item.label),
    priceTiers: normalizePriceTiers(
      roundPrice(product.basePrice ?? product.price),
      product.priceTiers
    ).map(serializePriceTier),
    updatedAt: firestoreServerTimestamp(),
  };
}

export async function seedMissingCatalogProducts() {
  const snapshot = await getDocs(collection(db, PRODUCTS_COLLECTION));
  const existingIds = new Set(snapshot.docs.map((item) => item.id));
  const missingProducts = fallbackCatalog.filter((product) => !existingIds.has(product.id));

  if (missingProducts.length === 0) {
    return { added: 0 };
  }

  const batch = writeBatch(db);

  missingProducts.forEach((product) => {
    const productRef = doc(db, PRODUCTS_COLLECTION, product.id);
    batch.set(productRef, serializeProductForFirestore(product), { merge: true });
  });

  await batch.commit();
  return { added: missingProducts.length };
}

/** @deprecated Use seedMissingCatalogProducts — does not overwrite existing products. */
export async function seedOriginalCatalog() {
  return seedMissingCatalogProducts();
}

export function formatPrice(value) {
  return currencyFormatter.format(value || 0);
}

export function formatProductMeta(item) {
  return item?.size || item?.unit || "";
}

export function getRelatedProducts(products, currentProductId, count = 4) {
  const activeProduct = findProductByRouteParam(products, currentProductId);
  const sameCategory = (products || []).filter(
    (item) =>
      item.id !== activeProduct?.id &&
      item.category === activeProduct?.category
  );

  if (sameCategory.length >= count) {
    return sameCategory.slice(0, count);
  }

  const others = (products || []).filter(
    (item) =>
      item.id !== activeProduct?.id &&
      !sameCategory.some((related) => related.id === item.id)
  );

  return [...sameCategory, ...others].slice(0, count);
}
