import { collection, doc, getDocs, updateDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { FlatList, Text, TextInput, TouchableOpacity, View } from "react-native";
import { db } from "../../lib/firebase";

    type Order = {
      id: string;
      orderNumber?: string;
      fullName?: string;
      supplierName?: string;
      address?: string;
      fulfillmentStatus?: string;
      createdAtMs?: number;
      status?: string;
      items?: any[];
      paid?: boolean;
      paymentStatus?: string;
      cjSku?: string;
      cjProductId?: string;
      firestoreId?: string;
      sentToSupplier?: boolean;
      cjOrderNumber?: string;
      supplierOrderNumber?: string;
      cjOrderId?: string;
      supplierOrderId?: string;
      supplierStatus?: string;
    };

    type TrackingInput = {
      trackingNumber?: string;
      courier?: string;
      trackingUrl?: string;
    };

    const SEND_TO_SUPPLIER_URL = "https://us-central1-futuristekapp.cloudfunctions.net/sendOrderToSupplier";


    export default function AdminOrders() {
    const [orders, setOrders] = useState<Order[]>([]);
    const [trackingInputs, setTrackingInputs] = useState<Record<string, TrackingInput>>({});
    const [trackingNumber, setTrackingNumber] = useState("");
    const [courier, setCourier] = useState("");
    const [trackingUrl, setTrackingUrl] = useState("");
    const [supplierName, setSupplierName] = useState("");
    const [supplierOrderId, setSupplierOrderId] = useState("");
    const [supplierProductUrl, setSupplierProductUrl] = useState("");
    const [supplierInputs, setSupplierInputs] = useState<any>({});

    const fetchOrders = async () => {
    const snapshot = await getDocs(collection(db, "orders"));
    const data: Order[] = snapshot.docs.map((doc) => ({
      id: doc.id,
      firestoreId: doc.id,
      ...doc.data(),
    }));

    data.sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0));

    setOrders(data);
      };

      useEffect(() => {
        fetchOrders();
      }, []);

      
      const updateStatus = async (
        orderId: string,
        status: string,
        trackingNumber = "",
        courier = "",
        trackingUrl = "",
        supplierName = "",
        supplierOrderId = "",
        supplierProductUrl = ""
      ) => {
        const updateData: any = {
          status,
          fulfillmentStatus: status,
          updatedAt: new Date().toISOString(),
        };
        if (status === "PROCESSING") {
          updateData.supplierName = supplierName;
          updateData.supplierOrderId = supplierOrderId;
          updateData.supplierProductUrl = supplierProductUrl;
          updateData.supplierStatus = "SENT";
          updateData.sentToSupplierAt = new Date().toISOString();
        }
        if (status === "SHIPPED") {
          updateData.trackingNumber = trackingNumber;
          updateData.courier = courier;
          updateData.trackingUrl = trackingUrl;
          updateData.shippedAt = new Date().toISOString();
        }
        if (status === "DELIVERED") {
          updateData.deliveredAt = new Date().toISOString();
        }

        await updateDoc(doc(db, "orders", orderId), updateData);
        fetchOrders();
      };

      return (
        <View style={{ 
        flex: 1,
        backgroundColor: "#000", 
        padding: 16 
      }}>
         <FlatList
            data={orders}
            contentContainerStyle={{ paddingBottom: 40 }}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => {

              const firstItem = (item.items as any)?.[0];

              const autoSupplierProductUrl =
                supplierInputs[item.id]?.supplierProductUrl ||
                firstItem?.supplierProductUrl ||
                "";

              const currentStatus = String(item.status || "").toUpperCase();

              const alreadySent =
                currentStatus === "PROCESSING" &&
                item.supplierStatus === "SENT" &&
                item.sentToSupplier === true;
              

          return (
            <View
              style={{
                backgroundColor: "#111",
                padding: 12,
                marginBottom: 12,
                borderRadius: 10,
              }}
            >
              <Text style={{ color: "#fff", fontWeight: "bold" }}>
                {item.orderNumber}
              </Text>

              <Text style={{ color: "#ccc" }}>{item.fullName}</Text>
              <Text style={{ color: "#ccc" }}>{item.address}</Text>

              <Text style={{ color: "#0af", marginTop: 5 }}>
                Status: {
                    item.sentToSupplier === true
                      ? item.fulfillmentStatus || item.status || "PROCESSING"
                      : "PLACED"
                  }
              </Text>

              <Text style={{ color: "#fff", marginTop: 6 }}>
                CJ SKU: {item?.items?.[0]?.cjSku || "Not found"}
              </Text>

              <Text style={{ color: "#6f6", marginTop: 4 }}>
                CJ Product ID: {item?.items?.[0]?.cjProductId || "Not set / optional"}
              </Text>

          
          <TextInput
            placeholder="Supplier Name (e.g. CJ Dropshipping)"
             value={
                item.sentToSupplier
                  ? supplierInputs[item.id]?.supplierName ?? item.supplierName ?? ""
                  : supplierInputs[item.id]?.supplierName ?? ""
              }
              onChangeText={(text) =>
                setSupplierInputs((prev: any) => ({
                  ...prev,
                  [item.id]: {
                    ...prev[item.id],
                    supplierName: text,
                  },
                }))
              }
            style={{
              backgroundColor: "#222",
              color: "#fff",
              marginTop: 8,
              padding: 8,
              borderRadius: 6,
            }}
          />

          <TextInput
            placeholder="Supplier Order ID"
             value={
                  item.sentToSupplier
                    ? supplierInputs[item.id]?.supplierOrderId ??
                      item.supplierOrderId ??
                      item.cjOrderId ??
                      ""
                    : supplierInputs[item.id]?.supplierOrderId ?? ""
                }
              onChangeText={(text) =>
                setSupplierInputs((prev: any) => ({
                  ...prev,
                  [item.id]: {
                    ...prev[item.id],
                    supplierOrderId: text,
                  },
                }))
              }
            style={{
              backgroundColor: "#222",
              color: "#fff",
              marginTop: 8,
              padding: 8,
              borderRadius: 6,
            }}
          />

          <TextInput
            placeholder="Supplier Product URL"
            value={
              supplierInputs[item.id]?.supplierProductUrl ??
              (item.items as any)?.[0].supplierProductUrl ??
              ""
            }
            onChangeText={(text: string) =>
              setSupplierInputs((prev: any) => ({
                ...prev,
                [item.id]: {
                  ...prev[item.id],
                  supplierProductUrl: text,
                },
              }))
            }
            style={{
              backgroundColor: "#222",
              color: "#fff",
              marginTop: 8,
              padding: 8,
              borderRadius: 6,
            }}
          />

          <TextInput
            placeholder="Tracking Number"
            value={trackingInputs[item.id]?.trackingNumber || ""}
            onChangeText={(text) =>
              setTrackingInputs((prev: any) => ({
                ...prev,
                [item.id]: {
                  ...prev[item.id],
                  trackingNumber: text,
                },
              }))
            }
            style={{
              backgroundColor: "#222",
              color: "#fff",
              marginTop: 8,
              padding: 8,
              borderRadius: 6,
            }}
          />

          <TextInput
            placeholder="Courier (e.g. Royal Mail)"
            value={trackingInputs[item.id]?.courier || ""}
            onChangeText={(text) =>
              setTrackingInputs((prev: any) => ({
                ...prev,
                [item.id]: {
                  ...prev[item.id],
                  courier: text,
                },
              }))
            }
            style={{
              backgroundColor: "#222",
              color: "#fff",
              marginTop: 8,
              padding: 8,
              borderRadius: 6,
            }}
          />

          <TextInput
            placeholder="Tracking URL"
            value={trackingInputs[item.id]?.trackingUrl || ""}
            onChangeText={(text) =>
              setTrackingInputs((prev: any) => ({
                ...prev,
                [item.id]: {
                  ...prev[item.id],
                  trackingUrl: text,
                },
              }))
            }
            style={{
              backgroundColor: "#222",
              color: "#fff",
              marginTop: 8,
              padding: 8,
              borderRadius: 6,
            }}
          />
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              gap: 12,
              marginTop: 14,
            }}
          >

            <TouchableOpacity
              disabled={alreadySent}
              onPress={async () => {
                if (alreadySent) return;
                const input = supplierInputs[item.id] || {};
                const isPaid =
                item.paid === true ||
                String(item.paymentStatus || "").toUpperCase() === "PAID";

              if (!isPaid) {
                alert("This order is not paid yet. Do not send to supplier.");
                return;
              }
               const firstItem = Array.isArray(item.items) ? item.items[0] : null;

                const supplierProductUrl =
                  input.supplierProductUrl ||
                  firstItem?.supplierProductUrl ||
                  "";

                const response = await fetch("https://us-central1-futuristekapp.cloudfunctions.net/sendOrderToSupplier", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  orderId: item.firestoreId || item.id,
                  supplierName: input.supplierName || "",
                  supplierOrderId: input.supplierOrderId || "",
                  supplierProductUrl,

                  cjSku: firstItem?.cjSku || item.cjSku || "",
                  cjProductId: firstItem?.cjProductId || item.cjProductId || "",
                }),
              });

                const data = await response.json();

                console.log("CJ RAW DATA:", JSON.stringify(data, null, 2));

                
                const cjSuccess =
                  data?.success === true ||
                  data?.result === true ||
                  data?.cjOrder?.success === true ||
                  data?.cjOrder?.result === true ||
                  data?.cjOrder?.code === 200 ||
                  data?.code === 200;

                
                if (!response.ok && !cjSuccess) {
                  alert(data?.message || data?.error || "Failed to send order to supplier.");
                  return;
                }

              
                await updateDoc(doc(db, "orders", item.id), {
                  fulfillmentStatus: "PROCESSING",
                  status: "PROCESSING",

                  supplierName: "CJ Dropshipping",

                  supplierOrderId: data?.cjOrder?.data?.orderId || "",
                  cjOrderId: data?.cjOrder?.data?.orderId || "",

                  supplierOrderNumber: data?.cjOrder?.data?.orderNumber || "",
                  cjOrderNumber: data?.cjOrder?.data?.orderNumber || "",

                  sentToSupplier: true,
                  supplierSentAt: new Date().toISOString(),
                });

                alert("Order sent to supplier successfully 🚀");

                console.log("CJ RESPONSE:", data);

                fetchOrders();
              }}
            >
              <Text
                style={{
                  color: alreadySent ? "#777" : "lightgreen",
                  paddingVertical: 6,
                  paddingHorizontal: 8,
                }}
              >
                {alreadySent ? "Sent to Supplier" : "Send to Supplier"}
              </Text>
            </TouchableOpacity>

              <TouchableOpacity
                onPress={() => updateStatus(item.id, "PLACED")}
              >
                <Text style={{ 
                  color: "#4da3ff",  
                  paddingVertical: 6,
                  paddingHorizontal: 8, 
                  }}
                >
                  Placed
                </Text>
              </TouchableOpacity>

            <TouchableOpacity
              onPress={() => updateStatus(item.id, "PROCESSING")}
            >
              <Text style={{ 
                color: "orange",  
                paddingVertical: 6,
                paddingHorizontal: 8, 
                }}
              >
                Processing
              </Text>
            </TouchableOpacity>

           <TouchableOpacity
              onPress={() => {
              const input = trackingInputs[item.id] || {};

              updateStatus(
                item.id,
                "SHIPPED",
                input.trackingNumber || "",
                input.courier || "",
                input.trackingUrl || ""
              );
            }}
            >
              <Text
                style={{
                  color: "lightgreen",
                  paddingVertical: 6,
                  paddingHorizontal: 8,
                }}
              >
                Shipped
              </Text>
           </TouchableOpacity>

            <TouchableOpacity
              onPress={() => updateStatus(item.id, "DELIVERED")}
            >
              <Text style={{ 
                color: "green", 
                paddingVertical: 6,
                paddingHorizontal: 8, 
                }}
              >
                Delivered
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }}
    />
    </View>
  );
}
