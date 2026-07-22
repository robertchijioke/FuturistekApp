import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import { useEffect } from "react";

export function useInitialNotificationNavigation() {
  useEffect(() => {
    async function checkInitialNotification() {
      const response = await Notifications.getLastNotificationResponseAsync();
      const data = response?.notification?.request?.content?.data as {
        orderId?: string;
      };

      if (data?.orderId) {
        router.push({
          pathname: "/orders/[id]",
          params: { id: data.orderId },
        } as never);
      }
    }

    checkInitialNotification();
  }, []);

  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as {
        orderId?: string;
      };

      if (data?.orderId) {
        router.push({
          pathname: "/orders/[id]",
          params: { id: data.orderId },
        } as never);
      }
    });

    return () => sub.remove();
  }, []);
}