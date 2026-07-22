import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";
import * as MediaLibrary from "expo-media-library";
import { useRouter } from "expo-router";
import * as Speech from "expo-speech";
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from "expo-speech-recognition";
import { onAuthStateChanged } from "firebase/auth";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View
} from "react-native";
import { useCart } from "../../context/CartContext";
import { auth, db } from "../../lib/firebase";
import {
  getDeviceSummary,
  runAwayModeScene,
  runGoodNightScene,
  runMorningModeScene,
  runMovieModeScene,
  turnDeviceOff, turnDeviceOn,
} from "../../lib/smartHomeActions";



export default function SupportScreen() {
  const [message, setMessage] = useState("");
  const [orderNumber, setOrderNumber] = useState("");
  const [email, setEmail] = useState("");
  const router = useRouter();
  const [reply, setReply] = useState("");
  const [loading, setLoading] = useState(false);
  const [chat, setChat] = useState<any[]>([]);
  const [bundleLoading, setBundleLoading] = useState(false);
  const [generatedImage, setGeneratedImage] = useState("");
  const [roomImage, setRoomImage] = useState("");
  const [imageLoading, setImageLoading] = useState(false);
  const [selectedStyle, setSelectedStyle] = useState("Cyberpunk");
  const [isListening, setIsListening] = useState(false);
  const [voiceFinalText, setVoiceFinalText] = useState("");
  const [shouldSpeakReply, setShouldSpeakReply] = useState(false);
  const [uploadedRoom, setUploadedRoom] = useState("");
  const [redesignedRoom, setRedesignedRoom] = useState("");
  const [uploadedRoomBase64, setUploadedRoomBase64] = useState("");
  const [recommendedProducts, setRecommendedProducts] = useState<any[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [roomPreview, setRoomPreview] = useState("");

  const { addToCart, items } = useCart();

    useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      console.log(
      "AUTH STATE CHANGED:",
      user ? user.uid : "NO USER YET",
      user ? user.email : ""
    );

    setCurrentUser(user ?? null);
    });

    return unsubscribe;
  }, []);


    useEffect(() => {
      const checkPendingRoom = async () => {
        if (!currentUser) return;

        const saved = await AsyncStorage.getItem("pendingRoomDesign");
        if (!saved) return;

        const pending = JSON.parse(saved);

        setReply(pending.aiText || "");
        setRoomImage(pending.imageUrl || "");
        setGeneratedImage(pending.imageUrl || "");
        setSelectedStyle(pending.theme || "Cyberpunk");
        setRecommendedProducts(pending.recommendedProducts || []);

        setChat([
          {
            type: "ai",
            text: pending.aiText || "",
            roomPreview: pending.roomPreview || "",
            generatedImage: pending.imageUrl || "",
            recommendedProducts: pending.recommendedProducts || [],
            recommendedHandles: pending.recommendedHandles || [],
          },
        ]);

        setTimeout(() => {
          scrollRef.current?.scrollToEnd({ animated: true });
        }, 600);
      };

      checkPendingRoom();
    }, [currentUser]);

    useEffect(() => {
      const restorePendingRoom = async () => {
        const user = auth.currentUser || currentUser;
        if (!user) return;

        const pending = await AsyncStorage.getItem("pendingRoomDesign");
        if (!pending) return;

        const item = JSON.parse(pending);

        setReply(item.aiText || "");
        setGeneratedImage(item.imageUrl || "");
        setRoomImage(item.imageUrl || "");
        setSelectedStyle(item.theme || "Cyberpunk");
        setRoomPreview(item.roomPreview || "");
        setRecommendedProducts(item.recommendedProducts || []);

        setChat([
          {
            type: "ai",
            text: item.aiText || "",
            roomPreview: item.roomPreview || "",
            generatedImage: item.imageUrl || "",
            recommendedProducts: item.recommendedProducts || [],
            recommendedHandles: item.recommendedHandles || [],
          },
        ]);

        setTimeout(() => {
          scrollRef.current?.scrollToEnd({ animated: true });
        }, 800);
      };

      restorePendingRoom();
    }, [currentUser]);

    const saveRoomDesign = async (item: any) => {
      try {
        console.log("SAVE ROOM FUNCTION STARTED", item);

        const user = auth.currentUser || currentUser;

        if (!user) {
          await AsyncStorage.setItem(
            "pendingRoomDesign",
            JSON.stringify({
              userMessage: item.userMessage || message || voiceFinalText || "",
              aiText: item.text || reply || "",
              roomPreview: item.roomPreview || "",
              imageUrl: roomImage || generatedImage || "",
              theme: selectedStyle || "Cyberpunk",
              recommendedHandles: item.recommendedHandles || [],
              recommendedProducts:
                item.recommendedProducts?.length > 0
                  ? item.recommendedProducts
                  : recommendedProducts || [],
            })
          );

          alert("Please log in to save this room design.");
          router.push({
            pathname: "/login",
            params: { redirectTo: "/support", savePendingRoom: "1" },
          });
          return;
        }

        await addDoc(collection(db, "users", user.uid, "savedRooms"), {
          prompt: item.userMessage || message || voiceFinalText || "",
          aiText: item.text || reply || "",
          roomPreview: item.roomPreview || "",
          imageUrl: "", // keep empty, do not save base64 to Firestore
          theme: selectedStyle || "Cyberpunk",
          recommendedHandles: item.recommendedHandles || [],
          recommendedProducts:
            item.recommendedProducts?.length > 0
              ? item.recommendedProducts
              : recommendedProducts || [],
          createdAt: serverTimestamp(),
        });

        await AsyncStorage.removeItem("pendingRoomDesign");

        if (roomImage?.startsWith("data:image")) {
          const { status } = await MediaLibrary.requestPermissionsAsync();

          if (status === "granted") {
            const base64Data = roomImage.split(",")[1];

            const fileUri =
              FileSystem.cacheDirectory + `futuristek-room-${Date.now()}.png`;

            await FileSystem.writeAsStringAsync(fileUri, base64Data, {
              encoding: FileSystem.EncodingType.Base64,
            });

            await MediaLibrary.saveToLibraryAsync(fileUri);
          }
        }

        Alert.alert(
          "Success",
          "Room design saved and added to your gallery."
        );
      } catch (error) {
        console.error("SAVE ROOM ERROR:", error);
        alert("Could not save room design.");
      }
    };



useSpeechRecognitionEvent("result", (event) => {
  const transcript = event.results?.[0]?.transcript;

  if (transcript) {
    setMessage(transcript);
    setVoiceFinalText(transcript);
  }
});

useSpeechRecognitionEvent("end", () => {
  setIsListening(false);

  setTimeout(() => {
    if (voiceFinalText.trim()) {
      const finalVoice = voiceFinalText.trim();

      if (finalVoice) {
        setVoiceFinalText(finalVoice);
        setMessage(finalVoice);

        setTimeout(() => {
          sendMessage(finalVoice, true);
          setVoiceFinalText("");
        }, 800);
      }
    }
  }, 4500);
});

useSpeechRecognitionEvent("end", () => {
  setIsListening(false);
});

  const scrollRef = useRef<ScrollView>(null);

  const addBundleToCart = (products: any[]) => {
    if (!products?.length) return;

    products.forEach((product) => {
      addToCart({
        id: product.handle,
        name: product.title,
        price: Number(product.price) || 0,
        image: product.images?.[0] || product.image || "",
      });
    });

    router.push("/cart");
  };

  const sendMessage = async (voiceText?: string, speakReply = false) => {

  const finalMessage = voiceText || message;

  setMessage("");

  const lowerMessage = finalMessage.toLowerCase();

if (
  lowerMessage.includes("turn on") ||
  lowerMessage.includes("switch on") ||
  lowerMessage.includes("power on") ||
  lowerMessage.includes("put on") ||
  lowerMessage.includes("lights on") ||
  lowerMessage.includes("light on")
) {
  const deviceName = finalMessage
    .replace(/turn on/i, "")
    .replace(/switch on/i, "")
    .replace(/power on/i, "")
    .replace(/put on/i, "")
    .replace(/turn/i, "")
    .replace(/\bon\b/i, "")
    .trim();

  setChat((prev) => [
    ...prev,
    { type: "user", text: finalMessage },
    { type: "ai", text: `⚡ Turning ${deviceName} ON...` },
  ]);

  const reply = await turnDeviceOn(deviceName);

  setChat((prev) => [
    ...prev,
    { type: "ai", text: `✅ ${reply}` },
  ]);

  return;
  }

  if (
  lowerMessage.includes("lights out") ||
  lowerMessage.includes("turn off") ||
  lowerMessage.includes("switch off") ||
  lowerMessage.includes("power off") ||
  lowerMessage.includes("put off") ||
  lowerMessage.includes("lights off") ||
  lowerMessage.includes("light off")
) {
    const deviceName = finalMessage
      .replace(/turn off/i, "")
      .replace(/switch off/i, "")
      .replace(/power off/i, "")
      .replace(/put off/i, "")
      .replace(/\boff\b/i, "")
      .trim();

    setChat((prev) => [
      ...prev,
      { type: "user", text: finalMessage },
      { type: "ai", text: `⚡ Turning ${deviceName} OFF...` },
    ]);

    const reply = await turnDeviceOff(deviceName);

    setChat((prev) => [
      ...prev,
      { type: "ai", text: `✅ ${reply}` },
    ]);

    return;
    }

    if (
      lowerMessage.includes("offline devices") ||
      lowerMessage.includes("device summary") ||
      lowerMessage.includes("how many devices")
    ) {
      const reply = await getDeviceSummary();

      setChat((prev) => [
        ...prev,
        {
          type: "user",
          text: finalMessage,
        },
        {
          type: "ai",
          text: reply,
        },
      ]);

      return;
    }

    if (
      lowerMessage.includes("what can you do") ||
      lowerMessage.includes("things you can do") ||
      lowerMessage.includes("list what you can do")
    ) {
      const reply =
        "I can control your smart home devices, turn devices on or off, run Good Night, Movie, Morning and Away modes, give device summaries, answer product questions, help with orders, and recommend Futuristek products.";

      setChat((prev) => [
        ...prev,
        { type: "user", text: finalMessage },
        { type: "ai", text: reply },
      ]);
      return;
    }

    if (
  lowerMessage.includes("good night") ||
  lowerMessage.includes("goodnight") ||
  lowerMessage.includes("night mode") ||
  lowerMessage.includes("i'm going to bed") ||
  lowerMessage.includes("going to bed") ||
  lowerMessage.includes("bed time") ||
  lowerMessage.includes("sleep time")
) {
      const reply = await runGoodNightScene();

      setChat((prev) => [
        ...prev,
        { type: "user", text: finalMessage },
        { type: "ai", text: reply },
      ]);

      return;
    }

    if (
  lowerMessage.includes("movie mode") ||
  lowerMessage.includes("movie time") ||
  lowerMessage.includes("watching a movie") ||
  lowerMessage.includes("cinema mode")
) {
      const reply = await runMovieModeScene();

      setChat((prev) => [
        ...prev,
        { type: "user", text: finalMessage },
        { type: "ai", text: reply },
      ]);

      return;
    }

    if (
  lowerMessage.includes("morning mode") ||
  lowerMessage.includes("good morning") ||
  lowerMessage.includes("wake up") ||
  lowerMessage.includes("start my day")
) {
      const reply = await runMorningModeScene();

      setChat((prev) => [
        ...prev,
        { type: "user", text: finalMessage },
        { type: "ai", text: reply },
      ]);

      return;
    }

    if (
  lowerMessage.includes("away mode") ||
  lowerMessage.includes("i'm leaving home") ||
  lowerMessage.includes("leaving home") ||
  lowerMessage.includes("going out") ||
  lowerMessage.includes("secure the house")
) {
      const reply = await runAwayModeScene();

      setChat((prev) => [
        ...prev,
        { type: "user", text: finalMessage },
        { type: "ai", text: reply },
      ]);

      return;
    }

    if (!finalMessage.trim()) return;

    try {
      setLoading(true);
      setReply("");

      setChat((prev) => [
        ...prev,
        {
          type: "user",
          text: finalMessage,
        },
        {
          type: "ai",
          text: "Typing...",
          loading: true,
        },
      ]);

      const res = await fetch(
        "https://us-central1-futuristekapp.cloudfunctions.net/aiSupportAssistant",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: finalMessage,
            orderNumber,
            email,
            products: recommendedProducts,
          }),
        }
      );

     const data = await res.json();

      console.log("FULL AI DATA:", data);
      console.log("AI DATA PRODUCTS:", data?.recommendedProducts);
      console.log("AI DATA HANDLES:", data?.recommendedHandles);

      console.log("AI SUPPORT RESPONSE:", data);

      const fullReply =
        data?.reply ||
        data?.error ||
        "No response from support assistant.";

        setTimeout(() => {
          scrollRef.current?.scrollToEnd({ animated: true });
        }, 500);

      const previewMatch =
        fullReply.match(
          /\[\[ROOM_PREVIEW\]\]([\s\S]*?)\[\[END_ROOM_PREVIEW\]\]/
        );

      const roomPreview =
        previewMatch?.[1]?.trim() || "";

      const productsMatch =
        fullReply.match(
          /\[\[PRODUCTS\]\]([\s\S]*?)\[\[END_PRODUCTS\]\]/i
        );

      const recommendedHandles =
          productsMatch?.[1]
            ?.split("\n")
            .map((x: string) => x.trim())
            .filter(Boolean) || [];


        let matchedProducts: any[] = [];

        try {
          if (recommendedHandles.length > 0) {
            const productResults = await Promise.all(
              recommendedHandles.map(async (handle: string) => {
                const cleanHandle = handle.trim();

                const res = await fetch(
                  `https://futuristekstore.com/products/${cleanHandle}.js`
                );

                if (!res.ok) return null;

                const product = await res.json();

                console.log(
                  "SHOPIFY PRODUCT:",
                  cleanHandle,
                  product
                );

                console.log(
                  "SHOPIFY IMAGE:",
                  cleanHandle,
                  getProductImage(product)
                );

                const cleanDescription = (product.body_html || product.description || "")
                .replace(/<[^>]*>/g, "")
                .trim();

               const firstImage =
                  product.image?.src ||
                  product.featured_image ||
                  product.images?.[0]?.src ||
                  product.images?.[0] ||
                  "";

                return {
                  handle: cleanHandle,
                  title: product.title,
                  price: product.price
                    ? (Number(product.price) / 100).toFixed(2)
                    : "",
                  image: firstImage,
                  description:
                    product.body_html?.replace(/<[^>]*>/g, "").trim() ||
                    product.description?.replace(/<[^>]*>/g, "").trim() ||
                    "",
                  url: `https://futuristekstore.com/products/${cleanHandle}`,
                };
              })
            );

            matchedProducts = productResults.filter(Boolean);
          }
        } catch (error) {
          console.log("PRODUCT FETCH ERROR:", error);
        }

        console.log("MATCHED PRODUCTS:", matchedProducts.length);


        
      const aiText = fullReply
      .replace(
        /\[\[ROOM_PREVIEW\]\][\s\S]*?\[\[END_ROOM_PREVIEW\]\]/gi,
        ""
      )
      .replace(
        /\[\[PRODUCTS\]\][\s\S]*?\[\[END_PRODUCTS\]\]/gi,
        ""
      )
      .trim();

      setGeneratedImage(roomPreview);

      setReply(aiText);

      console.log("ADDING AI ITEM:", {
        recommendedHandles,
        recommendedProducts,
      });

      console.log("BEFORE SET CHAT:", {
        recommendedHandles,
        recommendedProducts,
      });

      console.log(
        "PRODUCT COUNT:",
        matchedProducts?.length || 0
      );

      console.log(
        "HANDLE COUNT:",
        recommendedHandles?.length || 0
      );

      setChat((prev) =>
        prev.map((item) =>
          item.loading
            ? {
                type: "ai",
                text: aiText,
                loading: false,
                roomPreview,
                recommendedHandles:
                recommendedHandles?.length > 0
                  ? recommendedHandles
                  : recommendedProducts?.map((p: any) => p.handle).filter(Boolean) || [],

                recommendedProducts:
                  matchedProducts?.length > 0
                    ? matchedProducts
                    : [],
              }
            : item
        )
      );

     if (speakReply) {
       Speech.stop();

       const cleanAiText = aiText
        .replace(/\[\[PRODUCTS\]\][\s\S]*?\[\[END_PRODUCTS\]\]/g, "")
        .replace(/\[\[ROOM_PREVIEW\]\][\s\S]*?\[\[END_ROOM_PREVIEW\]\]/g, "")
        .trim();
       
        Speech.speak(removeUrls(cleanAiText), {
          language: "en-GB",
          pitch: 1,
          rate: 0.95,
        });
      }

      setMessage("");

      } catch (error) {
      setChat((prev) =>
        prev.map((item) =>
          item.loading
            ? {
                type: "ai",
                text: "Something went wrong. Please try again.",
                loading: false,
              }
            : item
        )
      );
    } finally {
      setLoading(false);
    }};

    const extractUrl = (text: string) => {
    const match = text.match(/https?:\/\/[^\s]+/);
      return match ? match[0] : null;
    };

    const removeUrls = (text: string) => {
      return text
        .replace(/https?:\/\/[^\s]+/gi, "")
        .replace(/product\s*url:?/gi, "")
        .replace(/product\s*link:?/gi, "")
        .replace(/view\s*product:?/gi, "")
        .replace(/website:?/gi, "")
        .replace(/https:?/gi, "")
        .replace(/\n\s*\n/g, "\n\n")
        .trim();
    };

    const extractUrls = (text: string) => {
      return text.match(/https?:\/\/[^\s]+/g) || [];
    };

    const pickRoomImage = async () => {
      try {
    const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        quality: 0.5,
        base64: true,
      });

        if (!result.canceled) {
          setUploadedRoom(result.assets[0].uri);
          setUploadedRoomBase64(result.assets[0].base64 || "");
        }
      } catch (error) {
        console.log("Pick image error:", error);
      }
    };

    const generateRoomImage = async (styleOverride?: string) => {
      try {
        setImageLoading(true);

        const styleToUse = styleOverride || selectedStyle || "Cyberpunk";

        const userIdea =
          message ||
          voiceFinalText ||
          roomPreview ||
          reply ||
          "modern futuristic room";

        const cleanPrompt = `
    Create a futuristic smart room interior design.

    User request:
    ${userIdea}

    Style:
    ${styleToUse}

    Use smart home elements, LED lighting, clean modern furniture, premium realistic interior design, cinematic lighting, and futuristic atmosphere.

    Do not include text, logos, labels, people, or watermarks in the image.
    `.trim();

        console.log("IMAGE PROMPT LENGTH:", cleanPrompt.length);

        const res = await fetch(
          "https://us-central1-futuristekapp.cloudfunctions.net/generateRoomImage",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              prompt: cleanPrompt,
            }),
          }
        );

    const rawText = await res.text();

    console.log("RAW IMAGE STATUS:", res.status);
    console.log("RAW IMAGE TEXT LENGTH:", rawText.length);

    let data: any = {};

    try {
      data = JSON.parse(rawText);
    } catch {
      console.log("IMAGE RESPONSE IS NOT JSON");
      alert("Image server returned an invalid response.");
      return;
    }

    

   const returnedImage =
      data?.imageBase64 ||
      data?.image ||
      data?.imageUrl ||
      data?.url ||
      data?.base64 ||
      data?.b64_json ||
      data?.data?.[0]?.b64_json ||
      data?.data?.[0]?.url;

    
    console.log("RETURNED IMAGE EXISTS:", !!returnedImage);
    console.log("RETURNED IMAGE LENGTH:", returnedImage?.length || 0);

    if (!returnedImage) {
      console.log("IMAGE FUNCTION FAILED:", data?.error || "No image returned");
      alert(data?.error || "Image generation failed");
      return;
    }

    const imageUri = returnedImage.startsWith("data:image")
      ? returnedImage
      : returnedImage.startsWith("http")
      ? returnedImage
      : `data:image/png;base64,${returnedImage}`;

    setRoomImage(imageUri);
    setGeneratedImage(imageUri);
      } catch (error) {
        console.log("IMAGE FUNCTION ERROR:", error);
        alert("Could not generate room image.");
      } finally {
        setImageLoading(false);
      }
    };

    const roomStyles = [
      "Cyberpunk",
      "Minimal",
      "RGB",
      "Luxury",
      "Dark",
      "White Modern",
    ];

    const getProductImage = (product: any) =>
      product?.image ||
      product?.featured_image ||
      product?.images?.[0]?.src ||
      product?.images?.[0] ||
      "";


  return (
    <ScrollView
      ref={scrollRef}
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 140 }}
      onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
    >
      <View style={styles.headerRow}>
        <Text style={styles.title}>
          Futuristek AI
        </Text>

        <Pressable
          onPress={() => router.push("/cart")}
          style={{ marginTop: -8 }}
        >
          <Ionicons
            name="cart-outline"
            size={34}
            color="#fff"
          />
        </Pressable>
      </View>

      <TextInput
        placeholder="Order Number (Optional)"
        placeholderTextColor="#888"
        value={orderNumber}
        onChangeText={setOrderNumber}
        style={styles.input}
      />

      <TextInput
        placeholder="Email (Optional)"
        placeholderTextColor="#888"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        style={styles.input}
      />

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>

    <Pressable
      style={styles.quickAction}
      onPress={() => sendMessage("Good Night")}
    >
      <Text style={styles.quickActionText}>🌙 Good Night</Text>
    </Pressable>

    <Pressable
      style={styles.quickAction}
      onPress={() => sendMessage("Movie Mode")}
    >
      <Text style={styles.quickActionText}>🎬 Movie</Text>
    </Pressable>

    <Pressable
      style={styles.quickAction}
      onPress={() => sendMessage("Morning Mode")}
    >
      <Text style={styles.quickActionText}>☀️ Morning</Text>
    </Pressable>

    <Pressable
      style={styles.quickAction}
      onPress={() => sendMessage("Away Mode")}
    >
      <Text style={styles.quickActionText}>🚪 Away</Text>
    </Pressable>

    <Pressable
      style={styles.quickAction}
      onPress={() => sendMessage("Device Summary")}
    >
      <Text style={styles.quickActionText}>📊 Summary</Text>
    </Pressable>

  </View>

      <TextInput
        placeholder="How can we help you?"
        placeholderTextColor="#888"
        value={message}
        onChangeText={setMessage}
        multiline
        style={[styles.input, styles.messageInput]}
      />

      <Pressable style={styles.button} onPress={() => sendMessage()}>
        {loading ? (
          <ActivityIndicator color="#000" />
        ) : (
          <Text style={styles.buttonText}>Ask AI Support</Text>
        )}
      </Pressable>

      <Pressable
        onPress={async () => {
          if (isListening) {
            await ExpoSpeechRecognitionModule.stop();
            setIsListening(false);
            return;
          }

          const result =
            await ExpoSpeechRecognitionModule.requestPermissionsAsync();

          if (!result.granted) {
            alert("Microphone permission denied");
            return;
          }

          setIsListening(true);

          await ExpoSpeechRecognitionModule.start({
            lang: "en-GB",
            interimResults: true,
            continuous: false,
          });
        }}
        style={{
          backgroundColor: isListening ? "#ff4444" : "#2563eb",
          padding: 12,
          borderRadius: 999,
          marginLeft: 10,
          marginBottom: 20,
        }}
      >
        <Text style={{ color: "white", fontWeight: "bold" }}>
          {isListening ? "Listening..." : "🎤 Speak to Futuristek AI"}
        </Text>
      </Pressable>

      <Pressable
        onPress={() => Speech.stop()}
        style={[
          styles.button,
          {
            marginTop: 10,
            backgroundColor: "#475569",
          },
        ]}
      >
        <Text style={styles.buttonText}>🔇 Stop Voice</Text>
      </Pressable>


<View style={styles.chatBox}>
  {chat.map((item, index) => (
    <View
      key={index}
      style={item.type === "user" ? styles.userBubble : styles.aiBubble}
    >
      <Text style={styles.senderLabel}>
        {item.type === "user" ? "You" : "Futuristek AI"}
      </Text>

      <Text style={styles.messageText}>
        {removeUrls(item.text)}
      </Text>

      {item.type === "ai" && item.roomPreview ? (
        <View style={styles.previewBox}>
          <Text style={styles.previewTitle}>AI Room Preview</Text>
          <Text style={styles.previewText}>{item.roomPreview}</Text>
        </View>
      ) : null}

      {item.type === "ai" && item.recommendedProducts?.length > 0 ? (
        <View style={styles.recommendedProductsBox}>
          <Text style={styles.previewTitle}>
            Recommended Futuristek Products
          </Text>

          {item.recommendedProducts.map((product: any) => {

            return (
            <Pressable
              key={product.handle}
              style={styles.recommendedProductCard}
              onPress={() =>
                router.push({
                  pathname: "/product/[id]",
                  params: {
                    id: product.handle,
                    title: product.title,
                    price: product.price,
                    image: product.image || product.images?.[0] || "",
                    description: product.description,
                  },
                })
              }
            >
              {product.image ? (
                <Image
                  source={{ uri: product.image.startsWith("//") ? `https:${product.image}` : product.image }}
                  style={styles.recommendedProductImage}
                  resizeMode="contain"
                />
              ) : null}

              <Text style={styles.recommendedProductTitle}>
                {product.title}
              </Text>

              {product.price ? (
                <Text style={styles.recommendedProductPrice}>
                  £{product.price}
                </Text>
              ) : null}

              <Text style={styles.viewProductButtonText}>
                View Product
              </Text>
            </Pressable>
            );
          })}

          <Text style={styles.bundleTotal}>
            Bundle Total: £
            {item.recommendedProducts
              .reduce((sum: number, p: any) => sum + (Number(p.price) || 0), 0)
              .toFixed(2)}
          </Text>

        <Pressable
          style={styles.bundleButton}
          disabled={bundleLoading}
          onPress={() => {
            if (bundleLoading) return;

            setBundleLoading(true);

            const alreadyInCart = item.recommendedProducts.every((product: any) =>
              items.some((cartItem: any) => cartItem.id === product.handle)
            );

            if (alreadyInCart) {
              setBundleLoading(false);
              router.push("/cart");
              return;
            }

            item.recommendedProducts.forEach((product: any) => {
              addToCart({
                id: product.handle,
                name: product.title,
                price: Number(product.price) || 0,
                image: product.images?.[0] || product.image || "",
              });
            });

            setTimeout(() => {
              setBundleLoading(false);
              router.push("/cart");
            }, 700);
          }}
        >
          <Text style={styles.bundleButtonText}>
            {bundleLoading ? "Adding..." : "Add Bundle to Cart"}
          </Text>
        </Pressable>
        </View>
      ) : null}
    </View>
  ))}
</View>

{reply ? (
  <>
    <Pressable
      style={styles.uploadRoomButton}
      onPress={pickRoomImage}
    >
      <Text style={styles.uploadRoomButtonText}>Upload Your Room</Text>
    </Pressable>

    {uploadedRoom ? (
      <Image
        source={{ uri: uploadedRoom }}
        style={styles.uploadedRoomImage}
        resizeMode="cover"
      />
    ) : null}

    <Pressable
      style={styles.generateImageButton}
      onPress={() => generateRoomImage(selectedStyle)}
    >
      <Text style={styles.generateImageButtonText}>
        {imageLoading
          ? "Creating Room..."
          : uploadedRoom
          ? "Redesign My Room"
          : "Generate Room Image"}
      </Text>
    </Pressable>

     <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.styleRow}
          contentContainerStyle={styles.styleRowContent}
        >
          {roomStyles.map((style) => (
            <Pressable
              key={style}
              onPress={() => {
               setSelectedStyle(style); 
              }}
              style={[
                styles.styleChip,
                selectedStyle === style && styles.activeStyleChip,
              ]}
            >
              <Text
                style={[
                  styles.styleChipText,
                  selectedStyle === style && styles.activeStyleChipText,
                ]}
              >
                {style}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

    {roomImage ? (
      <Image
        source={{ uri: roomImage }}
        style={styles.roomImage}
      />
    ) : null}

    {roomImage ? (
      <>
        <Pressable
          style={styles.secondaryButton}
          onPress={() =>
            saveRoomDesign({
              userMessage: message || voiceFinalText || "",
              text: reply || "",
              roomPreview: roomPreview || "",
              generatedImage: "",
              theme: selectedStyle,
              recommendedProducts,
              recommendedHandles: [],
            })
          }
        >
          <Text style={styles.secondaryButtonText}>Save Room Design</Text>
        </Pressable>

        <Pressable
          style={styles.regenerateButton}
          onPress={() => generateRoomImage(selectedStyle)}
        >
          <Text style={styles.regenerateButtonText}>Regenerate Design</Text>
        </Pressable>
      </>
    ) : null}
  </>
) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#071521",
    paddingHorizontal: 28,
    paddingTop: 42,
  },

  title: {
    color: "#fff",
    fontSize: 28,
    fontWeight: "900",
    marginBottom: 24,
  },

  card: {
    backgroundColor: "#101b33",
    borderWidth: 1,
    borderColor: "#1f2b46",
    borderRadius: 24,
    padding: 24,
    marginBottom: 22,
  },

input: {
  backgroundColor: "#263646",
  color: "#fff",
  borderRadius: 20,
  paddingHorizontal: 22,
  height: 72,
  fontSize: 18,
  marginBottom: 22,
},

messageInput: {
  backgroundColor: "#263646",
  color: "#fff",
  borderRadius: 20,
  paddingHorizontal: 22,
  paddingTop: 18,
  height: 150,
  fontSize: 18,
  marginBottom: 24,
  textAlignVertical: "top",
},

  button: {
    backgroundColor: "#2f6eea",
    borderRadius: 18,
    paddingVertical: 20,
    alignItems: "center",
    marginBottom: 26,
  },

  buttonText: {
    color: "#fff",
    fontSize: 19,
    fontWeight: "800",
  },

  chatBox: {
    gap: 18,
    paddingBottom: 40,
  },

  messageBubble: {
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderRadius: 22,
    borderWidth: 1,
    maxWidth: "86%",
  },

  userBubble: {
    backgroundColor: "#3B82F6",
    alignSelf: "flex-end",
    borderRadius: 24,

    paddingVertical: 14,
    paddingHorizontal: 18,

    marginBottom: 14,
    maxWidth: "82%",

    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },

  aiBubble: {
    backgroundColor: "#0f1b38",
    borderColor: "#1f2b46",
    alignSelf: "flex-start",
  },

  messageLabel: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 10,
  },

  messageText: {
    color: "#FFFFFF",
    fontSize: 17,
    lineHeight: 26,
    fontWeight: "600",
  },

  productLinkButton: {
  marginTop: 14,
  backgroundColor: "#2563eb",
  paddingVertical: 12,
  paddingHorizontal: 16,
  borderRadius: 14,
  alignItems: "center",
},

productLinkButtonText: {
  color: "#fff",
  fontSize: 16,
  fontWeight: "700",
},

bundleButton: {
  marginTop: 18,
  backgroundColor: "#7c3aed",
  paddingVertical: 16,
  borderRadius: 18,
  alignItems: "center",
},

bundleButtonText: {
  color: "#fff",
  fontSize: 16,
  fontWeight: "800",
},

previewBox: {
  backgroundColor: "#101c38",
  borderRadius: 20,
  padding: 18,
  marginTop: 20,
},

previewTitle: {
  color: "#fff",
  fontSize: 18,
  fontWeight: "700",
  marginBottom: 10,
},

previewText: {
  color: "#dbe7ff",
  fontSize: 15,
  lineHeight: 24,
},

generateImageButton: {
  marginTop: 18,
  backgroundColor: "#7c3aed",
  paddingVertical: 16,
  borderRadius: 18,
  alignItems: "center",
},

generateImageButtonText: {
  color: "#fff",
  fontSize: 16,
  fontWeight: "800",
},

roomImage: {
  marginTop: 18,
  width: "100%",
  height: 260,
  borderRadius: 22,
},

regenerateButton: {
  marginTop: 14,
  borderWidth: 1,
  borderColor: "#7c3aed",
  paddingVertical: 14,
  borderRadius: 18,
  alignItems: "center",
},

regenerateButtonText: {
  color: "#c4b5fd",
  fontSize: 15,
  fontWeight: "800",
},

styleRow: {
  marginTop: 14,
  marginBottom: 14,
  height: 58,
  maxHeight: 58,
  flexGrow: 0,
},

styleRowContent: {
  alignItems: "center",
},

styleChip: {
  height: 48,
  minWidth: 120,
  paddingHorizontal: 18,
  borderRadius: 999,
  backgroundColor: "#111827",
  marginRight: 10,
  borderWidth: 1,
  borderColor: "#374151",
  alignItems: "center",
  justifyContent: "center",
},

activeStyleChip: {
  backgroundColor: "#7c3aed",
  borderColor: "#a855f7",
},

styleChipText: {
  color: "#d1d5db",
  fontWeight: "700",
},

activeStyleChipText: {
  color: "#fff",
},

uploadRoomButton: {
  marginTop: 18,
  backgroundColor: "#111827",
  borderWidth: 1,
  borderColor: "#7c3aed",
  paddingVertical: 16,
  borderRadius: 18,
  alignItems: "center",
},

uploadRoomButtonText: {
  color: "#fff",
  fontSize: 16,
  fontWeight: "800",
},

uploadedRoomImage: {
  width: "100%",
  height: 220,
  borderRadius: 22,
  marginTop: 18,
},

recommendedProductsBox: {
  marginTop: 18,
  gap: 12,
},

recommendedProductCard: {
  backgroundColor: "#111827",
  borderRadius: 18,
  padding: 16,
  borderWidth: 1,
  borderColor: "#374151",
},

recommendedProductTitle: {
  color: "#fff",
  fontSize: 16,
  fontWeight: "800",
  textTransform: "capitalize",
},

recommendedProductAction: {
  color: "#8B5CF6",
  fontSize: 14,
  fontWeight: "800",
  marginTop: 8,
},

viewProductButton: {
  backgroundColor: "#2563eb",
  paddingVertical: 16,
  borderRadius: 20,
  alignItems: "center",
  justifyContent: "center",
  marginTop: 18,
},

viewProductButtonText: {
  color: "#FFFFFF",
  fontSize: 16,
  fontWeight: "700",
  textAlign: "center",
},

senderLabel: {
  color: "#A7B0C8",
  fontSize: 14,
  fontWeight: "700",
  marginBottom: 10,
},

recommendedProductImage: {
  width: 120,
  height: 120,
  borderRadius: 12,
  alignSelf: "center",
  marginBottom: 12,
},

recommendedProductPrice: {
  color: "#b388ff",
  fontSize: 16,
  fontWeight: "700",
  marginTop: 6,
  marginBottom: 10,
},

secondaryButton: {
  marginTop: 12,
  borderWidth: 1,
  borderColor: "#8B5CF6",
  borderRadius: 18,
  paddingVertical: 16,
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: "transparent",
},

secondaryButtonText: {
  color: "#C4B5FD",
  fontSize: 18,
  fontWeight: "700",
},

aiBadge: {
  backgroundColor: "#13284a",
  padding: 10,
  borderRadius: 10,
  marginBottom: 12,
},

aiBadgeText: {
  color: "#9f6cff",
  fontWeight: "700",
  textAlign: "center",
},

bundleTotal: {
  color: "#ffffff",
  fontSize: 18,
  fontWeight: "800",
  marginTop: 18,
  marginBottom: 12,
  textAlign: "center",
},

headerRow: {
  flexDirection: "row",
  justifyContent: "space-between",
  alignItems: "center",
  marginTop: 50,
  marginBottom: 28,
},

quickAction: {
  backgroundColor: "#16304d",
  paddingHorizontal: 14,
  paddingVertical: 10,
  borderRadius: 20,
},

quickActionText: {
  color: "#fff",
  fontWeight: "600",
},
});