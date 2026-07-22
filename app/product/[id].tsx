import { useCart } from "../../context/CartContext";

import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import ImageViewer from "react-native-image-zoom-viewer";
import { fetchShopifyProducts } from "../../lib/shopify";


export default function ProductDetails() {
  console.log("PRODUCT DETAILS SCREEN OPENED");
  const handleAddToCart = () => {
  setAdding(true);

addToCart({
  id: String(product.id),
  name: product.name,
  price: product.price,
  image: product.image,

  cjSku: product.cjSku || product.variantSku || product.sku || "",
  cjProductId: product.cjProductId || product.productId || product.spu || "",
});

  setTimeout(() => {
    setAdding(false);
  }, 700);
};

  const { addToCart } = useCart();

 
  const params = useLocalSearchParams();

  const id = String(params.id || "");

  const [product, setProduct] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);

useEffect(() => {
  const loadProduct = async () => {
    try {
      const products = await fetchShopifyProducts();
      const found = products.find((p) => String(p.handle) === String(id));

     setProduct({
        ...(found || {}),
        id: String(params.id || found?.id || ""),
        handle: String(params.id || found?.handle || ""),
        name: String(params.title || found?.name || found?.title || ""),
        title: String(params.title || found?.title || found?.name || ""),
        price: Number(params.price || found?.price || 0),
        image: String(params.image || found?.image || ""),
        description: String(
          params.description ||
          found?.description ||
          "No description available."
        ),
      });
    } catch (error) {
      console.log("Product details fetch error:", error);
      setProduct(null);
    } finally {
      setLoading(false);
    }
  };

  loadProduct();
}, [id]);

if (loading) {
  return (
    <View style={styles.center}>
      <Text style={styles.title}>Loading product...</Text>
    </View>
  );
}

  if (!product) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Product not found</Text>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  const imageUrls = (product.images && product.images.length > 0
  ? product.images
  : product.image
  ? [product.image]
  : []
).map((img: string) => ({
  url: img,
}));

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Pressable onPress={() => router.back()} style={styles.backBtn}>
        <Text style={styles.backText}>← Back</Text>
      </Pressable>

<View style={styles.card}>
  <View style={styles.galleryWrap}>
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.gallery}
    >
      {(product.images && product.images.length > 0
        ? product.images
        : product.image
        ? [product.image]
        : []
      ).map((img: string, index: number) => (
        <Pressable
        key={`${img}-${index}`}
        style={styles.imageWrap}
        onPress={() => {
          setViewerIndex(index);
          setViewerVisible(true);
        }}
      >
          <Image
            source={{ uri: img }}
            style={styles.image}
            resizeMode="contain"
          />
        </Pressable>
      ))}
    </ScrollView>

    {(product.images && product.images.length > 1) && (
      <View style={styles.swipeBadge}>
        <Text style={styles.swipeBadgeText}>→</Text>
      </View>
    )}
  </View>

  <Text style={styles.galleryHint}>Swipe for more photos →</Text>

        <Text style={styles.name}>{product.name}</Text>
        <Text style={styles.price}>£{Number(product.price).toFixed(2)}</Text>

        <Text style={styles.sectionTitle}>About this item</Text>
        <Text style={styles.desc}>
          {product.description
            ? product.description.replace(/<[^>]*>/g, "")
            : "No description available."}
        </Text>

        <Pressable
        style={({ pressed }) => [
          styles.cta,
          pressed && styles.ctaPressed,
          adding && styles.ctaAdded,
        ]}
        onPress={handleAddToCart}
      >
        <Text style={styles.ctaText}>
          {adding ? "Added ✓" : "Add to Cart"}
        </Text>
      </Pressable>

            </View>

          <Modal
            visible={viewerVisible}
            transparent={true}
            animationType="fade"
            onRequestClose={() => setViewerVisible(false)}
          >
            <View style={styles.viewerContainer}>
              <Pressable
                style={styles.viewerClose}
                onPress={() => setViewerVisible(false)}
              >
                <Text style={styles.viewerCloseText}>✕</Text>
              </Pressable>

              <ImageViewer
                imageUrls={imageUrls}
                index={viewerIndex}
                enableSwipeDown
                onSwipeDown={() => setViewerVisible(false)}
                onCancel={() => setViewerVisible(false)}
                saveToLocalByLongPress={false}
                backgroundColor="black"
                renderIndicator={(currentIndex, allSize) => (
                  <Text style={styles.viewerIndicator}>
                    {currentIndex} / {allSize}
                  </Text>
                )}
              />
            </View>
          </Modal>

          </ScrollView>
        );
      }

const styles = StyleSheet.create({
  screen: { 
   flex: 1, 
   backgroundColor: "#071A2A" 
  },

  content: { 
   padding: 16, 
   paddingBottom: 28 
  },

  center: { 
   flex: 1, 
   alignItems: "center", 
   justifyContent: "center", 
   padding: 16 
  },

  title: { 
   fontSize: 20, 
   fontWeight: "700", 
   color: "#fff", 
   marginBottom: 12 
  },

  backBtn: {
   alignSelf: "flex-start",
   paddingVertical: 10,
   paddingHorizontal: 12,
   borderRadius: 10,
   backgroundColor: "rgba(255,255,255,0.12)",
   marginBottom: 12,
  },

  backText: { 
   color: "#fff", 
   fontWeight: "600" 
  },

  card: {
   backgroundColor: "rgba(255,255,255,0.10)",
   borderRadius: 18,
   padding: 14,
   overflow: "hidden",
  },

imageWrap: {
  width: 300,
  height: 260,
  backgroundColor: "#ffffff",
  borderRadius: 14,
  padding: 16,
  justifyContent: "center",
  alignItems: "center",
  marginRight: 12,
},

  image: {
   width: "100%",
   height: "100%",
  },

  name: { 
   color: "#fff", 
   fontSize: 22, 
   fontWeight: "800", 
   marginBottom: 6 
  },

  price: { 
   color: "#6EC1FF", 
   fontSize: 18, 
   fontWeight: "700", 
   marginBottom: 14 
  },

  sectionTitle: { 
   color: "#fff", 
   fontSize: 16, 
   fontWeight: "800", 
   marginBottom: 8 },

  desc: { 
   color: "rgba(255,255,255,0.85)", 
   lineHeight: 20, 
   marginBottom: 16 
  },

  cta: {
    backgroundColor: "#0B6FBF",
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
  },

  ctaText: {
   color: "#fff", 
   fontWeight: "800" 
  },

  imagePlaceholder: {
  width: "100%",
  height: "100%",
  justifyContent: "center",
  alignItems: "center",
},

placeholderText: {
  color: "#666",
  fontSize: 16,
},

ctaPressed: {
  opacity: 0.9,
  transform: [{ scale: 0.98 }],
},

ctaAdded: {
  backgroundColor: "#1FAA59",
},

gallery: {
  paddingRight: 8,
  marginBottom: 12,
},

galleryWrap: {
  position: "relative",
},

swipeBadge: {
  position: "absolute",
  right: 10,
  top: 12,
  backgroundColor: "rgba(0,0,0,0.45)",
  paddingHorizontal: 10,
  paddingVertical: 6,
  borderRadius: 999,
},

swipeBadgeText: {
  color: "#fff",
  fontSize: 16,
  fontWeight: "700",
},

galleryHint: {
  color: "rgba(255,255,255,0.7)",
  fontSize: 13,
  marginTop: 6,
  marginBottom: 10,
},

viewerContainer: {
  flex: 1,
  backgroundColor: "black",
},

viewerClose: {
  position: "absolute",
  top: 50,
  right: 20,
  zIndex: 20,
  width: 42,
  height: 42,
  borderRadius: 21,
  backgroundColor: "rgba(255,255,255,0.18)",
  alignItems: "center",
  justifyContent: "center",
},

viewerCloseText: {
  color: "#fff",
  fontSize: 22,
  fontWeight: "700",
},

viewerIndicator: {
  color: "#fff",
  fontSize: 14,
  fontWeight: "600",
  marginTop: 16,
},

});
