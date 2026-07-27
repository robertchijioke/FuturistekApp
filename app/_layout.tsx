import { StripeProvider } from "@stripe/stripe-react-native";
import { Stack } from "expo-router";
import { useEffect } from "react";

import { CartProvider } from "../context/CartContext";
import { IncidentProvider } from "../context/IncidentContext";
import { setupNotifications } from "../lib/notifications";
import {
  useInitialNotificationNavigation,
} from "../utils/useNotificationNavigation";

export default function RootLayout() {
  useEffect(() => {
    setupNotifications().catch(console.error);
  }, []);

  useInitialNotificationNavigation();

  return (
    <StripeProvider
      publishableKey={
        process.env
          .EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY!
      }
    >
      <CartProvider>
        <IncidentProvider>
          <Stack
            screenOptions={{
              headerShown: false,
            }}
          />
        </IncidentProvider>
      </CartProvider>
    </StripeProvider>
  );
}