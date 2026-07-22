export type ShopifyProduct = {
  id: string;
  name: string;
  price: number;
  image: string;
  images: string[];
  category: string;
  handle: string;
  description?: string;
  cjSku?: string;
  cjProductId?: string;
  sku?: string;
  spu?: string;
  variantSku?: string;
  productId?: string;
  title?: string;
};

const PRODUCTS_FUNCTION_URL =
  "https://getshopifyproducts-pjfxua5n4a-uc.a.run.app";

export async function fetchShopifyProducts(): Promise<ShopifyProduct[]> {
  const response = await fetch(PRODUCTS_FUNCTION_URL);
  console.log("Fetching from:", PRODUCTS_FUNCTION_URL);
  console.log("Response status:", response.status);

  console.log("Function status:", response.status);

  const rawText = await response.text();
  console.log("RAW RESPONSE:", rawText);

  const json = JSON.parse(rawText);

  if (!response.ok) {
    console.log("Function error:", json);
    throw new Error(json.error || "Failed to fetch products");
  }

  const products = (json.products || []).map((product: any) => ({
  ...product,

  cjSku:
    product.cjSku ||
    product.sku ||
    product.variantSku ||
    "",

  cjProductId:
    product.cjProductId ||
    product.spu ||
    product.productId ||
    "",
}));

console.log("FIRST PRODUCT:", products[0]);

return products;
}