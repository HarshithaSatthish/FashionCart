export const FALLBACK_PRODUCT_IMAGE = '/assets/products/product-placeholder.jpg';

export const FASHIONCART_PRODUCT_IMAGES = {
  "Classic T-Shirt": "/assets/products/classic-t-shirt.jpg",
  "Graphic T-Shirt": "/assets/products/graphic-t-shirt.jpg",
  "Slim Jeans": "/assets/products/slim-jeans.jpg",
  "Blue Jeans": "/assets/products/blue-jeans.jpg",
  "White Sneakers": "/assets/products/white-sneakers.jpg",
  "Running Sneakers": "/assets/products/running-sneakers.jpg",
  "Summer Dress": "/assets/products/summer-dress.jpg",
  "Party Dress": "/assets/products/party-dress.jpg",
  "Leather Handbag": "/assets/products/leather-handbag.jpg",
  "Tote Handbag": "/assets/products/tote-handbag.jpg",
  "Formal Shirt": "/assets/products/formal-shirt.jpg",
  "Casual Shirt": "/assets/products/casual-shirt.jpg",
  "Black Trousers": "/assets/products/black-trousers.jpg",
  "Chino Trousers": "/assets/products/chino-trousers.jpg",
  "Sportswear Top": "/assets/products/sportswear-top.jpg",
  "Sportswear Bottom": "/assets/products/sportswear-bottom.jpg",
  "Denim Jacket": "/assets/products/denim-jacket.jpg",
  "Bomber Jacket": "/assets/products/bomber-jacket.jpg",
  "Belt": "/assets/products/belt.jpg",
  "Cap": "/assets/products/cap.jpg",
  "Scarf": "/assets/products/scarf.jpg",
  "Sunglasses": "/assets/products/sunglasses.jpg",
  "Loafers": "/assets/products/loafers.jpg",
  "Heels": "/assets/products/heels.jpg",
  "Hoodie": "/assets/products/hoodie.jpg",
  "Track Pants": "/assets/products/track-pants.jpg",
  "Cardigan": "/assets/products/cardigan.jpg",
  "Polo Shirt": "/assets/products/polo-shirt.jpg",
  "Cargo Trousers": "/assets/products/cargo-trousers.jpg",
  "Crossbody Handbag": "/assets/products/crossbody-handbag.jpg"
};

/**
 * Resolves a product object or product name string to its static image path.
 * Supports explicit image_url if provided by API, exact name match,
 * case-insensitive match, and falls back cleanly to the placeholder image.
 */
export function getProductImageUrl(productOrName) {
  if (!productOrName) return FALLBACK_PRODUCT_IMAGE;
  if (typeof productOrName === 'object' && productOrName !== null) {
    if (productOrName.image_url) return productOrName.image_url;
    if (productOrName.image_path) return productOrName.image_path;
  }
  const name = typeof productOrName === 'string'
    ? productOrName.trim()
    : (productOrName?.product_name || productOrName?.product || '').trim();

  if (!name) return FALLBACK_PRODUCT_IMAGE;
  if (FASHIONCART_PRODUCT_IMAGES[name]) return FASHIONCART_PRODUCT_IMAGES[name];

  const lower = name.toLowerCase();
  for (const [key, val] of Object.entries(FASHIONCART_PRODUCT_IMAGES)) {
    if (key.toLowerCase() === lower) return val;
  }
  return FALLBACK_PRODUCT_IMAGE;
}

if (typeof window !== 'undefined') {
  window.FASHIONCART_PRODUCT_IMAGES = FASHIONCART_PRODUCT_IMAGES;
  window.FALLBACK_PRODUCT_IMAGE = FALLBACK_PRODUCT_IMAGE;
  window.getProductImageUrl = getProductImageUrl;
}
