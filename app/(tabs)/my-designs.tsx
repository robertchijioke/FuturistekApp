import { collection, getDocs, orderBy, query } from "firebase/firestore";
import React, { useEffect, useState } from "react";
import { Image, ScrollView, StyleSheet, Text, View } from "react-native";
import { db } from "../../lib/firebase";

type Design = {
  id: string;
  imageUrl?: string;
  prompt?: string;
  createdAt?: any;
};

export default function MyDesignsScreen() {
  const [designs, setDesigns] = useState<Design[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadDesigns = async () => {
      try {
        const q = query(collection(db, "designs"), orderBy("createdAt", "desc"));
        const snap = await getDocs(q);

        const data = snap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Design[];

        setDesigns(data);
      } catch (error) {
        console.log("Designs fetch error:", error);
      } finally {
        setLoading(false);
      }
    };

    loadDesigns();
  }, []);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>My Designs</Text>

      {loading ? (
        <Text style={styles.muted}>Loading designs...</Text>
      ) : designs.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No saved designs yet</Text>
          <Text style={styles.emptyText}>
            Your generated room designs will appear here.
          </Text>
        </View>
      ) : (
        designs.map((design) => (
          <View key={design.id} style={styles.card}>
           {design.imageUrl ? (
              <Image
                source={{ uri: design.imageUrl }}
                style={styles.image}
              />
            ) : (
              <View style={[styles.image, styles.placeholderImage]}>
                <Text style={{ color: "#9ca3af", textAlign: "center" }}>
                  No image available
                </Text>
              </View>
            )}

            <Text style={styles.cardTitle}>
              {design.prompt || "Untitled design"}
            </Text>

            <Text style={styles.cardText}>Saved design</Text>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#071827",
  },
  content: {
    paddingTop: 70,
    paddingHorizontal: 24,
    paddingBottom: 120,
  },
  title: {
    color: "#fff",
    fontSize: 36,
    fontWeight: "900",
    marginBottom: 32,
  },
  muted: {
    color: "#9ca3af",
    fontSize: 18,
  },
  emptyCard: {
    backgroundColor: "#0E2436",
    borderRadius: 22,
    padding: 24,
  },
  emptyTitle: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "800",
    marginBottom: 12,
  },
  emptyText: {
    color: "#9ca3af",
    fontSize: 18,
    lineHeight: 28,
  },
  card: {
    backgroundColor: "#0E2436",
    borderRadius: 22,
    padding: 18,
    marginBottom: 20,
  },
  image: {
    width: "100%",
    height: 220,
    borderRadius: 18,
    backgroundColor: "#1f2937",
    marginBottom: 16,
  },
  cardTitle: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "800",
    marginBottom: 8,
  },
  cardText: {
    color: "#9ca3af",
    fontSize: 16,
  },

  placeholderImage: {
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: "#1f2937",
},

placeholderText: {
  color: "#9ca3af",
  fontSize: 16,
  fontWeight: "700",
  textAlign: "center",
},
});
