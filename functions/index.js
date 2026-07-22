    require("dotenv").config();

    const { setGlobalOptions } = require("firebase-functions/v2");
    const { onRequest } = require("firebase-functions/v2/https");
    const { onDocumentCreated, onDocumentUpdated, onDocumentWritten } = require("firebase-functions/v2/firestore");
    const logger = require("firebase-functions/logger");
    const admin = require("firebase-admin");
    const Stripe = require("stripe");
    const { Resend } = require("resend");
    const cors = require("cors")({ origin: true });
    const functions = require("firebase-functions");
    const fetch = require("node-fetch");
    const { cjRequest } = require("./cj");
    const { onSchedule } = require("firebase-functions/v2/scheduler");
    const crypto = require("crypto");
    const OpenAI = require("openai");
    const { defineSecret } = require("firebase-functions/params");
    const { toFile } = require("openai/uploads");

    const OPENAI_API_KEY = defineSecret("OPENAI_API_KEY");

    if (!admin.apps.length) {
      admin.initializeApp();
    }

    const db = admin.firestore();

    const resendApiKey = process.env.RESEND_API_KEY;
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    const shopifyWebhookSecret = process.env.SHOPIFY_WEBHOOK_SECRET;

    let resend = null;
    let stripe = null;
    if (resendApiKey) {
      resend = new Resend(resendApiKey);
    } else {
      logger.error("RESEND_API_KEY is missing");
    }

    if (stripeSecretKey) {
      stripe = new Stripe(stripeSecretKey);
    } else {
      logger.error("STRIPE_SECRET_KEY is missing");
    }

    const SHOPIFY_CLIENT_ID = process.env.SHOPIFY_CLIENT_ID;
    const SHOPIFY_CLIENT_SECRET = process.env.SHOPIFY_CLIENT_SECRET;
    

    setGlobalOptions({ maxInstances: 10 });
    
    logger.info("sendAdminOrderNotification version 2");

    exports.createPaymentIntent = onRequest(async (req, res) => {
      res.set("Access-Control-Allow-Origin", "*");
      res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
      res.set("Access-Control-Allow-Headers", "Content-Type");

      if (!stripe) {
      res.status(500).json({ error: "Stripe not configured" });
      return;
    }

      if (req.method === "OPTIONS") {
        res.status(204).send("");
        return;
      }

      try {
        if (req.method !== "POST") {
          res.status(405).json({ error: "Method Not Allowed" });
          return;
        }

        const {
          items = [],
          delivery = 0,
        } = req.body;

        if (!Array.isArray(items) || items.length === 0) {
          return res.status(400).json({ error: "No items provided" });
        }

        const subtotal = items.reduce((sum, item) => {
          const price = Number(item.price || 0);
          const qty = Number(item.qty || 1);
          return sum + price * qty;
        }, 0);

        const deliveryFee = Number(delivery || 0);
        const total = subtotal + deliveryFee;

        if (!Number.isFinite(total) || total <= 0) {
          return res.status(400).json({ error: "Invalid total amount" });
        }

        const amount = Math.round(total * 100); // Stripe uses pence

       const stripeCustomer = await stripe.customers.create({
        email: req.body.email || "",
        name: req.body.fullName || "",
        phone: req.body.phone || "",
      });

      const ephemeralKey = await stripe.ephemeralKeys.create(
        { customer: stripeCustomer.id },
        { apiVersion: "2024-06-20" }
      );

      const paymentIntent = await stripe.paymentIntents.create({
        amount,
        currency: "gbp",
        customer: stripeCustomer.id,
        payment_method_types: ["card"],
        setup_future_usage: "off_session",
      });

        res.status(200).json({
        paymentIntent: paymentIntent.client_secret,
        ephemeralKey: ephemeralKey.secret,
        customer: stripeCustomer.id,
        publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
      });
      } catch (error) {
        console.error("Stripe createPaymentIntent error:", error);
        res.status(500).json({
          error: error.message || "Internal server error",
        });
      }
    });

    exports.verifyStripePayment = onRequest(async (req, res) => {
      res.set("Access-Control-Allow-Origin", "*");
      res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
      res.set("Access-Control-Allow-Headers", "Content-Type");

      if (req.method === "OPTIONS") {
        res.status(204).send("");
        return;
      }

      try {
        if (req.method !== "POST") {
          res.status(405).json({ ok: false, error: "Method Not Allowed" });
          return;
        }

        if (!stripe) {
          res.status(500).json({ ok: false, error: "Stripe not configured" });
          return;
        }

        const paymentIntentId = String(req.body?.paymentIntentId || "").trim();

        if (!paymentIntentId) {
          res.status(400).json({ ok: false, error: "paymentIntentId is required" });
          return;
        }

        const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

        res.status(200).json({
          ok: true,
          paymentIntentId: paymentIntent.id,
          status: paymentIntent.status,
          amount: paymentIntent.amount,
          currency: paymentIntent.currency,
          metadata: paymentIntent.metadata || {},
        });
      } catch (error) {
        logger.error("verifyStripePayment error", {
          message: error?.message,
          stack: error?.stack,
        });

        res.status(500).json({
          ok: false,
          error: error?.message || "Unable to verify payment",
        });
      }
    });

    async function createOrderFromBackend(input) {
        const counterRef = db.collection("meta").doc("counters");

        const orderNumber = await db.runTransaction(async (transaction) => {
        const counterSnap = await transaction.get(counterRef);

        let nextNumber = 1;

        if (counterSnap.exists) {
          nextNumber = (counterSnap.data()?.orderNumber || 0) + 1;
        }

        transaction.set(
          counterRef,
          { orderNumber: nextNumber },
          { merge: true }
        );

        return `FUT-${String(nextNumber).padStart(6, "0")}`;
      });

      const cleanAddress =
        input.address ||
        [input.addressLine1, input.city, input.postcode]
          .filter(Boolean)
          .join(", ");

      const docRef = await db.collection("orders").add({
        userId: input.userId || "",
        orderNumber,

        fullName: input.fullName || "",
        email: input.email || "",
        phone: input.phone || "",
        address: cleanAddress,
        addressLine1: input.addressLine1 || "",
        city: input.city || "",
        postcode: input.postcode || "",

        items: Array.isArray(input.items) ? input.items : [],
        subtotal: Number(input.subtotal || 0),
        delivery: Number(input.deliveryFee || 0),
        deliveryFee: Number(input.deliveryFee || 0),
        total: Number(input.totalPrice || 0),
        totalPrice: Number(input.totalPrice || 0),
        totalItems: Array.isArray(input.items) ? input.items.length : 0,

        paymentIntentId: input.paymentIntentId || "",
        paymentStatus: input.paymentStatus || "PAID",
        paymentMethod: input.paymentMethod || "stripe",
        paid: input.paid ?? true,
        paidAt: input.paidAt || new Date().toISOString(),

        fulfillmentStatus: "UNFULFILLED",
        supplierStatus: "NOT_SENT",

        supplierName: "",
        supplierOrderId: "",
        supplierProductUrl: "",
        sentToSupplierAt: null,

        trackingNumber: "",
        trackingUrl: "",
        courier: "",
        shippedAt: null,
        deliveredAt: null,

        status: "PLACED",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        createdAtMs: Date.now(),

        estimatedDeliveryStart: new Date(
          Date.now() + 6 * 24 * 60 * 60 * 1000
        ).toISOString(),
        estimatedDeliveryEnd: new Date(
          Date.now() + 13 * 24 * 60 * 60 * 1000
        ).toISOString(),
      });

      return docRef.id;
    }

    exports.verifyPaymentAndCreateOrder = onRequest(async (req, res) => {
      res.set("Access-Control-Allow-Origin", "*");
      res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
      res.set("Access-Control-Allow-Headers", "Content-Type");

      if (req.method === "OPTIONS") {
        res.status(204).send("");
        return;
      }

      try {
        if (req.method !== "POST") {
          return res.status(405).json({ ok: false, error: "Method not allowed" });
        }

        if (!stripe) {
          return res.status(500).json({ ok: false, error: "Stripe is not configured" });
        }

        const {
          paymentIntentId,
          userId,
          email,
          fullName,
          phone,
          address,
          addressLine1,
          city,
          postcode,
          items,
          subtotal,
          deliveryFee,
          totalPrice,
        } = req.body || {};

        if (!paymentIntentId) {
          return res.status(400).json({ ok: false, error: "paymentIntentId is required" });
        }

        const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

        if (!paymentIntent) {
          return res.status(404).json({ ok: false, error: "Payment intent not found" });
        }

        if (paymentIntent.status !== "succeeded") {
          return res.status(400).json({
            ok: false,
            error: `Payment not completed. Current status: ${paymentIntent.status}`,
          });
        }

        const expectedAmount = Math.round(Number(totalPrice || 0) * 100);

        if (!expectedAmount || paymentIntent.amount !== expectedAmount) {
          return res.status(400).json({
            ok: false,
            error: "Payment amount mismatch",
            stripeAmount: paymentIntent.amount,
            expectedAmount,
          });
        }

        const orderPayload = {
          userId: userId || "",
          fullName: fullName || "",
          email: email || "",
          phone: phone || "",
          address: address || "",
          addressLine1: addressLine1 || "",
          city: city || "",
          postcode: postcode || "",
          items: Array.isArray(items) ? items : [],
          subtotal: Number(subtotal || 0),
          deliveryFee: Number(deliveryFee || 0),
          totalPrice: Number(totalPrice || 0),
          totalItems: Array.isArray(items) ? items.length : 0,
          paymentIntentId,
          paymentStatus: "PAID",
          paymentMethod: "stripe",
          status: "PLACED",
          fulfillmentStatus: "PLACED",
          sentToSupplier: false,
          supplierName: "",
          supplierOrderId: "",   
          cjOrderId: "",
          cjOrderNumber: "",
          supplierStatus: "",
          paid: true,
          paidAt: new Date().toISOString(),
        };
        const orderId = await createOrderFromBackend(orderPayload);

        await stripe.paymentIntents.update(paymentIntentId, {
          metadata: {
            orderId,
            email: email || "",
            fullName: fullName || "",
          },
        });

        return res.status(200).json({
          ok: true,
          orderId,
          paymentIntentId,
          message: "Payment verified and order created successfully",
        });
      } catch (error) {
        console.error("verifyPaymentAndCreateOrder error:", error);
        return res.status(500).json({
          ok: false,
          error: error?.message || "Internal server error",
        });
      }
    });

      exports.stripeWebhook = onRequest(
    {
      cors: false,
    },
    async (req, res) => {
      try {
        if (!stripe) {
          logger.error("Stripe is not configured");
          return res.status(500).send("Stripe not configured");
        }

        if (!stripeWebhookSecret) {
          logger.error("Stripe webhook secret is missing");
          return res.status(500).send("Webhook secret missing");
        }

        const sig = req.headers["stripe-signature"] || "";

        let event;

        try {
          event = stripe.webhooks.constructEvent(
            req.rawBody,
            sig,
            stripeWebhookSecret
          );
        } catch (err) {
          logger.error("Webhook signature verification failed", {
            message: err.message,
          });

          return res.status(400).send(`Webhook Error: ${err.message}`);
        }

        if (event.type === "payment_intent.succeeded") {
          const paymentIntent = event.data.object;

          const orderId =
            paymentIntent.metadata?.orderId ||
            paymentIntent.metadata?.orderDocId;

          const orderNumber = paymentIntent.metadata?.orderNumber || "";

          if (!orderId) {
            logger.error("No orderId found in payment intent metadata", {
              paymentIntentId: paymentIntent.id,
              orderNumber,
            });

            return res.status(200).send("No orderId metadata");
          }

          const orderRef = db.collection("orders").doc(orderId);

          const orderSnap = await orderRef.get();

          if (orderSnap.exists && orderSnap.data().paid === true) {
            logger.info("Order already marked as paid, skipping", { orderId });
            return res.status(200).send("Already processed");
          }

          await orderRef.update({
            paid: true,
            paymentStatus: "paid",
            paymentMethod: "Stripe",
            stripePaymentIntentId: paymentIntent.id,
            paidAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });

          logger.info("Order marked as paid from Stripe webhook", {
            orderId,
            orderNumber,
            paymentIntentId: paymentIntent.id,
          });
        }

        return res.status(200).send("Webhook received");
      } catch (error) {
        logger.error("Stripe webhook error", {
          message: error?.message || String(error),
        });

        return res.status(500).send("Webhook failed");
      }
    }
  );


      exports.sendOrderConfirmationEmailOnCreate = onDocumentCreated(
      "orders/{orderId}",
       async (event) => {
        try {
        const order = event.data?.data();

      logger.info("EMAIL FUNCTION TRIGGERED", {
        orderId: event.params.orderId,
        order,
      });

      if (!order) {
        logger.error("NO ORDER DATA");
        return;
      }

      const email = order.email;
      if (!email) {
        logger.error("NO EMAIL FOUND", { orderId: event.params.orderId });
        return;
      }

      logger.info("ABOUT TO SEND EMAIL", {
        email,
        orderNumber: order.orderNumber || event.params.orderId,
      });

      const subtotalValue = Number(order.subtotal ?? order.totalPrice ?? 0);
      const deliveryValue = Number(order.delivery ?? order.deliveryFee ?? 0);
      const displayTotal = subtotalValue + deliveryValue;

      const fullAddress = (order.address || "").trim();
      const structuredAddress = [
        order.addressLine1,
        order.city,
        order.postcode,
      ]
        .map((part) => (part || "").trim())
        .filter(Boolean)
        .join(", ");

      const displayAddress =
        structuredAddress && order.addressLine1
          ? structuredAddress
          : fullAddress || "Address not provided";

      const paidDateFormatted = order.paidAt
        ? new Date(order.paidAt).toLocaleString("en-GB", {
            day: "2-digit",
            month: "long",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
          })
        : "";

      const trackUrl = `https://futuristekstore.com/pages/track-order?orderNumber=${order.orderNumber || event.params.orderId}&email=${encodeURIComponent(email)}`;

      const result = await resend.emails.send({
        from: "Futuristek <support@futuristekstore.com>",
        to: email,
        reply_to: "support@futuristekstore.com",
        subject: `Order Confirmation - ${order.orderNumber || event.params.orderId}`,
        html: `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="UTF-8" />
              <meta name="viewport" content="width=device-width, initial-scale=1.0" />
              <title>Order Confirmation</title>
            </head>
            <body style="margin:0; padding:0; background-color:#020617; font-family:Arial, Helvetica, sans-serif; color:#ffffff;">
              <div style="padding:40px 20px;">
                <div style="max-width:640px; margin:0 auto; background:#08132b; border-radius:24px; padding:32px;">

                  <div style="text-align:center; margin-bottom:24px;">
                    <img
                      src="https://cdn.shopify.com/s/files/1/0979/0036/4163/files/logo1.png?v=1768367500"
                      alt="Futuristek"
                      style="max-width:160px; height:auto; display:block; margin:0 auto 12px;"
                    />
                    <div style="font-size:18px; color:#94a3b8;">Smart Home Tech, Simplified</div>
                  </div>

                  <div style="font-size:34px; margin-bottom:10px;">✅</div>
                  <div style="font-size:30px; font-weight:800; margin-bottom:16px;">Order Confirmed</div>

                  <div style="font-size:17px; line-height:1.7; color:#e2e8f0; margin-bottom:24px;">
                    Thanks <strong>${order.fullName || "Customer"}</strong>, your order has been confirmed and is now being prepared.
                  </div>

                  <div style="background:#0a1844; border-radius:18px; padding:18px; margin-bottom:24px;">
                    <div style="font-size:14px; color:#94a3b8; margin-bottom:8px;">Order Number</div>
                    <div style="font-size:24px; font-weight:800;">${order.orderNumber || event.params.orderId}</div>
                  </div>

                  <div style="margin-bottom:24px;">
                  <div style="font-size:20px; font-weight:800; margin-bottom:14px;">Items Ordered</div>

                  ${(order.items || []).map(item => `
                    <div style="display:flex; gap:14px; margin-bottom:16px; background:#0a1844; padding:14px; border-radius:14px;">
                      
                      <img 
                        src="${item.image || 'https://via.placeholder.com/80'}" 
                        alt="${item.name}" 
                        width="80" 
                        height="80"
                        style="border-radius:10px; object-fit:cover;"
                      />

                      <div style="flex:1;">
                        <div style="font-size:15px; font-weight:700; margin-bottom:4px;">
                          ${item.name}
                        </div>
                        <div style="font-size:14px; color:#94a3b8;">
                          Qty: ${item.quantity || 1}
                        </div>
                        <div style="font-size:14px; margin-top:4px;">
                          £${Number(item.price || 0).toFixed(2)}
                        </div>
                      </div>

                    </div>
                  `).join("")}
                </div>

                  <div style="margin-bottom:24px;">
                    <div style="font-size:20px; font-weight:800; margin-bottom:14px;">Order Summary</div>
                    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size:16px; color:#e2e8f0;">
                      <tr>
                        <td style="padding:8px 0;">Subtotal</td>
                        <td align="right" style="padding:8px 0;">£${Number(order.subtotal ?? 0).toFixed(2)}</td>
                      </tr>
                      <tr>
                        <td style="padding:8px 0;">Delivery</td>
                        <td align="right" style="padding:8px 0;">£${Number(order.delivery ?? order.deliveryFee ?? 0).toFixed(2)}</td>
                      </tr>
                      <tr>
                        <td style="padding:12px 0; font-weight:800; color:#ffffff;">Total</td>
                        <td align="right" style="padding:12px 0; font-weight:800; color:#ffffff;">
                          £${Number(order.total ?? order.totalPrice ?? 0).toFixed(2)}
                        </td>
                      </tr>
                    </table>
                  </div>

                  <div style="margin-bottom:24px;">
                    <div style="font-size:20px; font-weight:800; margin-bottom:14px;">Delivery Details</div>
                    <div style="background:#0a1844; border-radius:18px; padding:18px;">
                      <div style="font-size:16px; font-weight:700; margin-bottom:8px;">${order.fullName || ""}</div>
                      <div style="font-size:15px; color:#cbd5e1; line-height:1.7;">${order.phone || ""}</div>
                      <div style="font-size:15px; color:#cbd5e1; line-height:1.7;">
                        ${order.address || [order.addressLine1, order.city, order.postcode].filter(Boolean).join(", ")}
                      </div>
                    </div>
                  </div>

                  <div style="margin-bottom:24px;">
                    <div style="font-size:20px; font-weight:800; margin-bottom:14px;">Payment</div>
                    <div style="background:#0a1844; border-radius:18px; padding:18px;">
                      <div style="font-size:15px; color:#cbd5e1; line-height:1.7;">
                        Method: <strong style="color:#ffffff;">${(order.paymentMethod || "Stripe").toUpperCase() === "STRIPE" ? "Stripe" : order.paymentMethod}</strong>
                      </div>
                    </div>
                  </div>

                  <div style="text-align:center; margin:30px 0;">
                  <a
                  href="${trackUrl}"
                  style="
                    display:inline-block;
                    padding:14px 28px;
                    background:linear-gradient(135deg,#3b82f6,#60a5fa);
                    color:#ffffff;
                    text-decoration:none;
                    font-weight:700;
                    border-radius:12px;
                    font-size:16px;
                  "
                >
                  Track Your Order
                </a>
                </div>

                  <div style="font-size:15px; line-height:1.8; color:#cbd5e1;">
                    If you have any questions about your order, reply to this email or contact us at
                    <a href="mailto:support@futuristekstore.com" style="color:#60a5fa; text-decoration:none;">support@futuristekstore.com</a>.
                  </div>

                </div>

                <div style="text-align:center; color:#94a3b8; font-size:13px; margin-top:20px;">
                  © 2026 Futuristek. All rights reserved.
                </div>
              </div>
            </body>
          </html>
                `,
                text: `Order Confirmation - ${order.orderNumber || event.params.orderId}

                Thanks ${order.fullName || "Customer"}, your order has been confirmed and is now being prepared.

                Order Number: ${order.orderNumber || event.params.orderId}
                Subtotal: £${subtotalValue.toFixed(2)}
                Delivery: £${deliveryValue.toFixed(2)}
                Total: £${displayTotal.toFixed(2)}

                Track your order:
                ${trackUrl}`,
              });

              logger.info("EMAIL SENT SUCCESSFULLY", {
                resendResponse: result,
                orderId: event.params.orderId,
                email: order.email,
              });
            } catch (error) {
              logger.error("EMAIL ERROR", {
                message: error?.message,
                stack: error?.stack,
                error,
              });
            }
          }
        );



      exports.sendOrderStatusUpdateEmail = onDocumentUpdated("orders/{orderId}", async (event) => {
        try {
          const beforeData = event.data.before.data();
          const afterData = event.data.after.data();

          if (!beforeData || !afterData) return;

          const oldStatus = String(beforeData.status || "").toUpperCase();
          const newStatus = String(afterData.status || "").toUpperCase();

          if (!afterData.email) return;
          if (!newStatus) return;

          const allowedStatuses = ["SHIPPED", "DELIVERED"];
          if (!allowedStatuses.includes(newStatus)) return;

          if (oldStatus === newStatus) {
            return;
          }

          const sentFlag = `statusEmailSent_${newStatus}`;
          if (afterData[sentFlag]) {
            logger.info("STATUS EMAIL ALREADY SENT", {
              orderId: event.params.orderId,
              status: newStatus,
              email: afterData.email,
            });
            return;
          }

          const email = afterData.email;
          const orderNumber = afterData.orderNumber || event.params.orderId;

          const statusConfig = {
            PROCESSING: {
              badgeColor: "#2563eb",
              message: `Hi <strong>${afterData.fullName || "Customer"}</strong>, Good news — your order is now being processed.`,
            },
            SHIPPED: {
              badgeColor: "#f59e0b",
              message: `Hi <strong>${afterData.fullName || "Customer"}</strong>, Your order has now been shipped and is on the way.`,
            },
            DELIVERED: {
              badgeColor: "#16a34a",
              message: `Hi <strong>${afterData.fullName || "Customer"}</strong>, Your order has been marked as delivered. We hope you enjoy it.`,
            },
          };

          const badgeColor = statusConfig[newStatus]?.badgeColor || "#2563eb";
          const statusMessage =
            statusConfig[newStatus]?.message ||
            `Hi <strong>${afterData.fullName || "Customer"}</strong>, Your order status has been updated.`;

          const trackUrl =
            afterData.trackingUrl ||
            `https://futuristekstore.com/pages/track-order?orderNumber=${orderNumber}&email=${encodeURIComponent(email)}`;

          const result = await resend.emails.send({
            from: "Futuristek <support@futuristekstore.com>",
            to: email,
            reply_to: "support@futuristekstore.com",
            subject: `Order Update - ${orderNumber} - ${newStatus}`,
            html: `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="UTF-8" />
              <meta name="viewport" content="width=device-width, initial-scale=1.0" />
              <title>Order Status Update</title>
            </head>
            <body style="margin:0; padding:0; background:#020617; font-family:Arial, Helvetica, sans-serif; color:#ffffff;">
              <div style="width:100%; background:linear-gradient(180deg, #020617 0%, #03122f 100%); padding:32px 12px;">
                <div style="max-width:640px; margin:0 auto;">

            <div style="background:#08132b; border:1px solid rgba(148,163,184,0.25); border-radius:28px; padding:34px 28px; box-sizing:border-box;">

              <div style="text-align:center; margin-bottom:26px;">
                <img
                  src="https://cdn.shopify.com/s/files/1/0979/0036/4163/files/logo1.png?v=1768367500"
                  alt="Futuristek"
                  style="max-width:180px; height:auto; display:block; margin:0 auto 14px;"
                />
                <div style="font-size:18px; color:#94a3b8;">
                  Smart Home Tech, Simplified
                </div>
              </div>

              <div style="font-size:32px; font-weight:800; line-height:1.2; color:#ffffff; margin-bottom:24px; text-align:center;">
                Order Status Update
              </div>

              <div style="font-size:18px; line-height:1.8; color:#e2e8f0; margin-bottom:28px; text-align:center;">
                ${statusMessage}
              </div>

              <div style="background:#0a1844; border-radius:20px; padding:20px 22px; margin-bottom:22px;">
                <div style="font-size:15px; color:#94a3b8; margin-bottom:8px;">Order Number</div>
                <div style="font-size:22px; font-weight:800; color:#ffffff;">
                  ${orderNumber}
                </div>
              </div>

              <div style="margin-bottom:28px;">
                <span style="
                  display:inline-block;
                  background:${badgeColor};
                  color:#ffffff;
                  font-size:16px;
                  font-weight:800;
                  border-radius:999px;
                  padding:14px 26px;
                ">
                  ${newStatus}
                </span>
              </div>

              <div style="margin-bottom:28px;">
                <a
                  href="${trackUrl}"
                  style="
                    display:inline-block;
                    background:linear-gradient(90deg, #3b82f6 0%, #60a5fa 100%);
                    color:#ffffff;
                    text-decoration:none;
                    font-size:18px;
                    font-weight:800;
                    padding:18px 32px;
                    border-radius:18px;
                  "
                >
                  Track Your Order
                </a>
              </div>

              <div style="font-size:15px; line-height:1.9; color:#cbd5e1;">
                If you have any questions, reply to this email or contact us at
                <a href="mailto:support@futuristekstore.com" style="color:#60a5fa; text-decoration:none;">
                  support@futuristekstore.com
                </a>.
              </div>
            </div>

            <div style="text-align:center; color:#94a3b8; font-size:14px; padding:22px 12px 8px;">
              © 2026 Futuristek. All rights reserved.
            </div>

          </div>
        </div>
      </body>
      </html>
            `,
          });

          await event.data.after.ref.update({
            [sentFlag]: true,
            statusEmailLastSentAt: new Date().toISOString(),
          });

          logger.info("STATUS EMAIL SENT", {
            orderId: event.params.orderId,
            orderNumber,
            email,
            oldStatus,
            newStatus,
            resendResponse: result,
          });
        } catch (error) {
          logger.error("STATUS UPDATE EMAIL ERROR", {
            message: error?.message || String(error),
            stack: error?.stack || "",
          });
        }
      });

    exports.trackOrderLookup = onRequest(async (req, res) => {
      cors(req, res, async () => {
        try {
          if (req.method !== "POST") {
            return res.status(405).json({ ok: false, error: "Method not allowed" });
          }

          const orderNumberRaw = String(req.body.orderNumber || "").trim();
          const emailRaw = String(req.body.email || "").trim().toLowerCase();

          if (!orderNumberRaw || !emailRaw) {
            return res.status(400).json({
              ok: false,
              error: "Order number and email are required",
            });
          }

          const orderNumber = orderNumberRaw.toUpperCase();

          logger.info("TRACK ORDER REQUEST", {
            orderNumber,
            email: emailRaw,
          });

          const snapshot = await db
            .collection("orders")
            .where("orderNumber", "==", orderNumber)
            .limit(10)
            .get();

          if (snapshot.empty) {
            logger.info("TRACK ORDER NO ORDER NUMBER MATCH", { orderNumber });
            return res.status(404).json({
              ok: false,
              error: "We could not find an order matching those details.",
            });
          }

          let matchedOrder = null;

          snapshot.forEach((doc) => {
            const data = doc.data();
            const storedEmail = String(data.email || "").trim().toLowerCase();

            if (storedEmail === emailRaw) {
              matchedOrder = { id: doc.id, ...data };
            }
          });

          if (!matchedOrder) {
            logger.info("TRACK ORDER EMAIL MISMATCH", {
              orderNumber,
              email: emailRaw,
            });

            return res.status(404).json({
              ok: false,
              error: "We could not find an order matching those details.",
            });
          }

          const subtotal = Number(
            matchedOrder.subtotal ?? matchedOrder.totalPrice ?? 0
          );

          const delivery = Number(
            matchedOrder.delivery ?? matchedOrder.deliveryFee ?? 0
          );

      const total = subtotal + delivery;

      return res.status(200).json({
        ok: true,
        order: {
          orderNumber: matchedOrder.orderNumber || "",
          status: matchedOrder.status || "PLACED",
          subtotal,
          delivery,
          total,
          estimatedDeliveryStart: matchedOrder.estimatedDeliveryStart || null,
          estimatedDeliveryEnd: matchedOrder.estimatedDeliveryEnd || null,
          fullName: matchedOrder.fullName || "",
          phone: matchedOrder.phone || "",
          address:
            matchedOrder.address ||
            [
              matchedOrder.addressLine1,
              matchedOrder.city,
              matchedOrder.postcode,
            ]
              .filter(Boolean)
              .join(", "),
          items: matchedOrder.items || [],
        },
      });
} catch (error) {
  logger.error("TRACK ORDER ERROR", {
    message: error?.message,
    stack: error?.stack,
  });

  return res.status(500).json({
    ok: false,
    error: error?.message || "Something went wrong while checking your order.",
  });
}
  });
});

exports.sendAdminOrderNotification = onDocumentCreated(
  "orders/{orderId}",
  async (event) => {
    try {
      const snapshot = event.data;
      if (!snapshot) {
        logger.warn("No order snapshot found.");
        return;
      }

      const order = snapshot.data();
      const orderId = event.params.orderId;

      logger.info("New order created", { orderId, order });

      const devicesSnap = await admin.firestore().collection("adminDevices").get();

      if (devicesSnap.empty) {
        logger.warn("No admin devices found.");
        return;
      }

      const tokens = [];
      devicesSnap.forEach((doc) => {
        const data = doc.data();
        if (data && data.expoPushToken) {
          tokens.push(data.expoPushToken);
        }
      });

      if (!tokens.length) {
        logger.warn("No expo push tokens found in adminDevices.");
        return;
      }

const amount =
  typeof order.totalPrice === "number"
    ? `£${order.totalPrice.toFixed(2)}`
    : typeof order.subtotal === "number"
    ? `£${order.subtotal.toFixed(2)}`
    : "an order amount";

const itemCount =
  typeof order.totalItems === "number"
    ? order.totalItems
    : Array.isArray(order.items)
    ? order.items.reduce((sum, item) => sum + (item.qty || 1), 0)
    : 0;

const customerName =
  order.fullName && String(order.fullName).trim()
    ? order.fullName
    : "A customer";

const locationText =
  order.address && typeof order.address === "string"
    ? order.address.split(",")[1]?.trim() || order.address
    : "Unknown location";

const messages = tokens.map((token) => ({
  to: token,
  title: "New Order 🚀",
  body: `${itemCount} items • ${amount} • ${locationText}`,
  data: { orderId, screen: "orders" },
  sound: "order_alert.wav",
  channelId: "orders_custom_v2",
}));

      const response = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(messages),
      });

      const responseText = await response.text();

      logger.info("Expo push response", {
        status: response.status,
        body: responseText,
      });
    } catch (error) {
      logger.error("sendAdminOrderNotification failed", error);
    }
  }
);

exports.getShopifyProducts = onRequest(
  async (req, res) => {
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type, Shopify-Storefront-Private-Token");

    if (req.method === "OPTIONS") {
      return res.status(204).send("");
    }

    try {
      const storeDomain = process.env.SHOPIFY_STORE_DOMAIN;
      const apiVersion = process.env.SHOPIFY_API_VERSION || "2026-01";
      const token = process.env.SHOPIFY_STOREFRONT_PRIVATE_TOKEN;

      const shopifyUrl = `https://${storeDomain}/api/${apiVersion}/graphql.json`;

      const query = `
          query GetProducts {
            products(first: 20) {
              edges {
                node {
                  id
                  title
                  handle
                  description
                  featuredImage {
                    url
                  }
                    images(first: 5) {
                      edges {
                        node {
                          url
                        }
                      }
                    }
                  priceRange {
                    minVariantPrice {
                      amount
                      currencyCode
                    }
                  }
                  variants(first: 10) {
                    edges {
                      node {
                        id
                        title
                        sku
                        availableForSale
                        price {
                          amount
                          currencyCode
                        }
                      }
                    }
                  }
                }
              }
            }
          }
          `;

      const shopifyResponse = await fetch(shopifyUrl, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Shopify-Storefront-Private-Token": token,
          },
        body: JSON.stringify({ query }),
      });

      const rawText = await shopifyResponse.text();
      console.log("Storefront status:", shopifyResponse.status);
      console.log("Storefront raw response:", rawText);

      const data = JSON.parse(rawText);

      if (!shopifyResponse.ok || data.errors) {
        return res.status(500).json({
          error: "Failed to fetch storefront products",
          details: data.errors || data,
        });
      }

      const products = (data?.data?.products?.edges || []).map(({ node }) => {
      const variant = node.variants?.edges?.[0]?.node || {};
      const price = node.priceRange?.minVariantPrice || {};

        return {
          id: node.id,
          name: node.title,
          title: node.title,
          handle: node.handle,
          description: node.descriptionHtml || "",
          images: [
          node.featuredImage?.url,
          ...(node.images?.edges || []).map(({ node: imageNode }) => imageNode.url),
          ].filter(Boolean),

          image: node.featuredImage?.url || node.images?.edges?.[0]?.node?.url || null,
          category: node.productType || "general",
          availableForSale: node.availableForSale,
          price: Number(price.amount || 0),
          currencyCode: price.currencyCode || "GBP",
          sku: variant.sku || "",
          variantSku: variant.sku || "",
          cjSku: variant.sku || "",
          cjProductId: "",
        };
      });

      return res.status(200).json({ products });
    } catch (error) {
      console.error("getShopifyProducts error:", error);

      return res.status(500).json({
        error: error.message || "Internal server error",
      });
    }
  }
);

    exports.trackOrder = functions.https.onRequest(async (req, res) => {
      res.set("Access-Control-Allow-Origin", "*");
      res.set("Access-Control-Allow-Headers", "Content-Type");

      if (req.method === "OPTIONS") {
        return res.status(204).send("");
      }

      try {
        const orderNumber = String(req.body.orderNumber || "").trim().toUpperCase();
        const email = String(req.body.email || "").trim().toLowerCase();

        if (!orderNumber || !email) {
          return res.status(400).json({
            error: "Order number and email required",
          });
        }

        const snap = await admin
          .firestore()
          .collection("orders")
          .where("orderNumber", "==", orderNumber)
          .limit(1)
          .get();

        if (snap.empty) {
          return res.status(404).json({
            error: "Order not found",
            searchedOrderNumber: orderNumber,
          });
        }

        const doc = snap.docs[0];
        const order = doc.data();

        const orderEmail = String(
          order.email || order.customerEmail || ""
        ).trim().toLowerCase();

        if (orderEmail !== email) {
          return res.status(403).json({
            error: "Email does not match this order",
          });
        }

        return res.status(200).json({
          order: {
            id: doc.id,
            ...order,
            status: order.fulfillmentStatus || order.status || "PLACED",
            fulfillmentStatus: order.fulfillmentStatus || order.status || "PLACED",
            trackingUrl: order.trackingUrl || "",
            trackingNumber: order.trackingNumber || "",
            courier: order.courier || "",
          },
        });
      } catch (error) {
        console.error("trackOrder error:", error);
        return res.status(500).json({
          error: "Server error",
        });
      }
    });

    exports.sendOrderToSupplier = functions.https.onRequest(async (req, res) => {
      console.log("🔥 NEW VERSION WITH SKU 🔥");
      try {
        const {
          orderId,
          supplierName,
          supplierOrderId,
          supplierProductUrl,
          cjSku,
          cjProductId,
        } = req.body;

        console.log("REQ BODY:", req.body);
        console.log("ORDER ID:", orderId);

        if (!orderId) {
          return res.status(400).json({ error: "Missing orderId" });
        }

        if (!cjSku) {
          return res.status(400).json({ error: "Missing cjSku" });
        }

        const orderRef = admin.firestore().collection("orders").doc(orderId);

        
        const cjRes = await cjRequest("/authentication/getAccessToken", {
          apiKey: process.env.CJ_API_KEY,
        });

        console.log("CJ TOKEN RESPONSE:", JSON.stringify(cjRes, null, 2));

        const accessToken = cjRes?.data?.accessToken;

        if (!accessToken) {
          throw new Error("No CJ access token");
        }

        
        const cjOrderPayload = {
          orderNumber: orderId,
          fromCountryCode: "CN",
          logisticName: "CJPacket Ordinary",

          shippingCountry: "United Kingdom",
          shippingCountryCode: "GB",
          shippingProvince: "",
          shippingCity: "WEST MALLING",
          shippingCounty: "",
          shippingAddress: "20 PINEWOOD CLOSE",
          shippingAddress2: "",
          shippingZip: "ME19 5FH",
          shippingPhone: "07831732126",
          shippingCustomerName: "Robert Chijioke Ogo",

          email: "",
          remark: "",
          payType: 3,
          platform: "shopify",

          products: [
            {
              sku: cjSku,
              quantity: 1,
            },
          ],
        };

        console.log("CJ ORDER PAYLOAD:", JSON.stringify(cjOrderPayload, null, 2));

        
        const createOrderRes = await fetch(
          "https://developers.cjdropshipping.com/api2.0/v1/shopping/order/createOrderV2",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "CJ-Access-Token": accessToken,
            },
            body: JSON.stringify(cjOrderPayload),
          }
        );

        const orderResult = await createOrderRes.json();

        console.log("🚀 CJ ORDER RESPONSE:", JSON.stringify(orderResult, null, 2));

        
        await orderRef.update({
          supplierName: "CJ Dropshipping",
          supplierOrderId: orderResult?.data?.orderId || "",
          supplierProductUrl: supplierProductUrl || "",
          cjSku: cjSku || "",
          cjProductId: cjProductId || "",
          supplierStatus: "SENT",
          sentToSupplierAt: new Date().toISOString(),

          fulfillmentStatus: "PROCESSING",
          status: "PROCESSING",
          updatedAt: new Date().toISOString(),
        });

        
        if (orderResult?.result !== true && orderResult?.code !== 200) {
          return res.status(400).json({
            success: false,
            message: orderResult?.message || "CJ order failed",
            cjOrder: orderResult,
          });
        }

        return res.status(200).json({
          success: true,
          message: "Order sent to CJ successfully",
          cjOrder: orderResult,
        });
      } catch (error) {
        console.error("SEND ORDER ERROR:", error);
        return res.status(500).json({ error: error.message });
      }
    });

        
    exports.autoSendOrderToSupplier = onDocumentWritten(
      "orders/{orderId}",
      async (event) => {
        const before = event.data?.before?.data() || null;
        const order = event.data?.after?.data() || null;

        if (!order) return;

        const wasPaid = before
      ? before.paid === true ||
        String(before.paymentStatus || "").toUpperCase() === "PAID"
      : false;

        const isPaid =
          order.paid === true ||
          String(order.paymentStatus || "").toUpperCase() === "PAID";

        if (!isPaid) {
          console.log("Order not paid. Skipping...");
          return;
        }

        if (order.supplierStatus === "SENT" || order.sentToSupplier === true) {
          console.log("Already sent.");
          return;
        }

        const firstItem = order.items?.[0] || {};

        const cjSku = firstItem.cjSku || "";
        const cjProductId = firstItem.cjProductId || "";
        const supplierProductUrl = firstItem.supplierProductUrl || "";

        console.log("AUTO ORDER DATA:", {
          orderId: event.params.orderId,
          isPaid,
          supplierStatus: order.supplierStatus,
          sentToSupplier: order.sentToSupplier,
          firstItem,
          cjSku,
          cjProductId,
        });

        if (!cjSku) {
          console.log("Missing cjSku. Auto send stopped.");
          return;
        }

        try {
          const response = await fetch(
            "https://us-central1-futuristekapp.cloudfunctions.net/sendOrderToSupplier",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                orderId: event.params.orderId,
                supplierName: "CJ Dropshipping",
                supplierOrderId: "",
                    supplierProductUrl,
                    cjSku,
                    cjProductId,
                  }),
                }
              );
              const result = await response.json();
              console.log("AUTO SEND RESPONSE:", result);

            if (result?.success === true) {
              await event.data.after.ref.update({
                status: "PROCESSING",
                fulfillmentStatus: "PROCESSING",
                supplierStatus: "SENT",
                sentToSupplier: true,
                supplierName: "CJ Dropshipping",
                supplierOrderId:
                  result?.cjOrder?.data?.orderId ||
                  result?.cjOrder?.data?.orderNumber ||
                  "",
                supplierOrderNumber:
                  result?.cjOrder?.data?.orderNumber ||
                  "",
                supplierSentAt: new Date().toISOString(),
                sentToSupplierAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              });

                  console.log("✅ Firestore order updated to PROCESSING");
        } else {
          console.error(
            "❌ Auto send failed:",
            result?.message || result?.error || "Unknown error"
          );
        }
      } catch (err) {
        console.error("❌ Error:", err);
      }
    });

    async function getCJAccessToken() {
      const res = await fetch(
        "https://developers.cjdropshipping.com/api2.0/v1/authentication/getAccessToken",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: process.env.CJ_EMAIL,
            password: process.env.CJ_API_KEY,
          }),
        }
      );

      const data = await res.json();

      console.log("CJ token response:", data);

      if (!data.result || !data.data || !data.data.accessToken) {
        throw new Error("Failed to get CJ access token");
      }

      return data.data.accessToken;
    }

    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    exports.checkCJTrackingForOrders = onSchedule("every 1 hours", async () => {
      const snapshot = await db
        .collection("orders")
        .where("sentToSupplier", "==", true)
        .where("status", "==", "PROCESSING")
        .get();

        let accessToken;

        try {
          accessToken = await getCJAccessToken();
        } catch (error) {
          console.error("Could not get CJ access token:", error);
          return null;
        }
        
      for (const docSnap of snapshot.docs) {
        try {
          const order = docSnap.data();

          if (order.trackingNumber) continue;
          if (!order.cjOrderId && !order.supplierOrderId) continue;

          const cjOrderId = order.cjOrderId || order.supplierOrderId;

          await sleep(1500);

          
          const detailRes = await fetch(
            `https://developers.cjdropshipping.com/api2.0/v1/shopping/order/getOrderDetail?orderId=${cjOrderId}`,
            {
              method: "GET",
              headers: {
                "CJ-Access-Token": accessToken,
              },
            }
          );

          const detailJson = await detailRes.json();

          console.log("CJ order detail:", cjOrderId, detailJson);

          if (!detailJson.result) {
            console.log("CJ detail failed:", cjOrderId, detailJson);
            continue;
          }

          const cjData = detailJson.data || {};

          const trackingNumber =
            cjData.trackingNumber ||
            cjData.trackNumber ||
            cjData.logisticTrackingNumber ||
            cjData.logisticsTrackingNumber ||
            "";

          const courier =
            cjData.logisticName ||
            cjData.logisticsName ||
            cjData.shippingName ||
            cjData.carrier ||
            "CJdropshipping";

          let trackingUrl =
            cjData.trackingUrl ||
            cjData.trackUrl ||
            cjData.logisticTrackingUrl ||
            "";
          if (trackingNumber && !trackingUrl) {
            trackingUrl = `https://t.17track.net/en#nums=${trackingNumber}`;
          }

          
          if (trackingNumber) {
            await docSnap.ref.update({
              status: "SHIPPED",
              fulfillmentStatus: "SHIPPED",
              trackingNumber,
              courier,
              trackingUrl,
              shippedAt: admin.firestore.FieldValue.serverTimestamp(),
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
              cjTrackingSynced: true,
              customerNotifiedShipped: false,
              notificationReason: "TRACKING_RECEIVED",
            });

            console.log(`Order ${docSnap.id} updated to SHIPPED`);
          } else {
            console.log(`No tracking yet for order ${docSnap.id}`);
          }

          await sleep(1500);
          
        } catch (error) {
          console.error(`Tracking check failed for ${docSnap.id}:`, error);
        }
      }

      return null;
    });

      exports.checkDeliveredOrders = onSchedule("every 12 hours", async () => {
       const snapshot = await db
        .collection("orders")
        .where("status", "==", "SHIPPED")
        .get();

      let accessToken;

      try {
        accessToken = await getCJAccessToken();
      } catch (error) {
        console.error("Could not get CJ access token for delivered check:", error);
        return null;
      }

      for (const docSnap of snapshot.docs) {
        try {
          const order = docSnap.data();

          if (!order.trackingNumber) continue;
          if (!order.cjOrderId && !order.supplierOrderId) continue;

          const cjOrderId = order.cjOrderId || order.supplierOrderId;

          await sleep(1500);

          const detailRes = await fetch(
            `https://developers.cjdropshipping.com/api2.0/v1/shopping/order/getOrderDetail?orderId=${cjOrderId}`,
            {
              method: "GET",
              headers: {
                "CJ-Access-Token": accessToken,
              },
            }
          );

          const detailJson = await detailRes.json();

          console.log("CJ delivered check:", cjOrderId, detailJson);

          if (!detailJson.result) {
            console.log("CJ delivered detail failed:", cjOrderId, detailJson);
            continue;
          }

          const cjData = detailJson.data || {};

          const cjStatus = String(
            cjData.orderStatus ||
              cjData.logisticsStatus ||
              cjData.trackStatus ||
              cjData.deliveryStatus ||
              ""
          ).toUpperCase();

          const deliveredWords = ["DELIVERED", "COMPLETED", "RECEIVED"];

          const isDelivered = deliveredWords.some((word) =>
            cjStatus.includes(word)
          );

          if (isDelivered) {
            await docSnap.ref.update({
              status: "DELIVERED",
              fulfillmentStatus: "DELIVERED",
              deliveredAt: admin.firestore.FieldValue.serverTimestamp(),
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
              cjDeliveredSynced: true,
            });

            console.log(`Order ${docSnap.id} updated to DELIVERED`);
          } else {
            console.log(`Order ${docSnap.id} not delivered yet: ${cjStatus}`);
          }

          await sleep(1500);
        } catch (error) {
          console.error(`Delivered check failed for ${docSnap.id}:`, error);
        }
      }

      return null;
    });

    exports.shopifyOrderWebhook = onRequest(async (req, res) => {
      try {
        console.log("SHOPIFY WEBHOOK RECEIVED");

        const order = req.body;

        const shopifyOrderId = String(order.id || "");
        const orderNumber = String(order.name || order.order_number || shopifyOrderId);
        const email = order.email || order.contact_email || "";
        const shipping = order.shipping_address || {};
        const lineItem = order.line_items?.[0] || {};

        if (!shopifyOrderId) {
          return res.status(400).json({ ok: false, error: "Missing Shopify order ID" });
        }

        const paymentStatus = String(order.financial_status || "").toUpperCase();

        if (paymentStatus !== "PAID") {
          return res.status(200).json({ ok: true, skipped: "Order not paid yet" });
        }

        await db.collection("orders").doc(`shopify_${shopifyOrderId}`).set(
          {
            source: "SHOPIFY_WEB",
            shopifyOrderId,
            orderNumber,
            email,

            fullName: `${shipping.first_name || ""} ${shipping.last_name || ""}`.trim(),
            phone: shipping.phone || order.phone || "",

            address: shipping.address1 || "",
            addressLine1: shipping.address1 || "",
            addressLine2: shipping.address2 || "",
            city: shipping.city || "",
            postcode: shipping.zip || "",
            country: shipping.country || "United Kingdom",
            countryCode: shipping.country_code || "GB",

            cjSku: lineItem.sku || "",
            title: lineItem.title || "",
            quantity: lineItem.quantity || 1,

            paymentStatus: "PAID",
            paid: true,
            status: "PLACED",

            sentToSupplier: false,
            supplierStatus: "PENDING",

            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

        return res.status(200).json({ ok: true });
      } catch (error) {
        console.error("SHOPIFY WEBHOOK ERROR:", error);
        return res.status(500).json({ ok: false, error: error.message });
       }
    });

exports.aiSupportAssistant = onRequest(
  {
    secrets: [
      "OPENAI_API_KEY",
    ],
  },
  (req, res) => {
    cors(req, res, async () => {
      try {
        if (req.method !== "POST") {
          return res.status(405).json({ ok: false, error: "Method not allowed" });
        }

        const { message, orderNumber, email, products: requestProducts = [] } = req.body || {};

        if (!message) {
          return res.status(400).json({ ok: false, error: "Missing message" });
        }

        let orderContext = "";

        if (orderNumber && email) {
          const snap = await db
            .collection("orders")
            .where("orderNumber", "==", String(orderNumber).trim())
            .where("email", "==", String(email).trim().toLowerCase())
            .limit(1)
            .get();

          if (!snap.empty) {
            const order = snap.docs[0].data();

            const trackingLink =
              order.trackingUrl ||
              order.trackingURL ||
              order.trackUrl ||
              order.trackURL ||
              order.trackingUrl ||
              "";

            orderContext = `
      Customer order:
      Order number: ${order.orderNumber || ""}
      Status: ${order.status || ""}
      Tracking number: ${order.trackingNumber || "Not available yet"}
      Courier: ${order.courier || "Not available yet"}
      Tracking URL: ${trackingLink || "Not available yet"}
      `;
                }
              }

      let productContext = "";

      try {
        const productsRes = await fetch(
          " https://getshopifyproducts-pjfxua5n4a-uc.a.run.app"
        );

        const productsData = await productsRes.json();
        
        console.log("RAW PRODUCTS RESPONSE:", JSON.stringify(productsData, null, 2));
        const fetchedProducts = Array.isArray(productsData)
          ? productsData
          : productsData.products || [];

        const products =
          requestProducts.length > 0
            ? requestProducts
            : fetchedProducts;

        console.log("PRODUCTS DATA TYPE:", Array.isArray(productsData) ? "array" : typeof productsData);
        console.log("AI PRODUCT COUNT:", products.length);

        console.log(
          "FIRST PRODUCT HANDLE:",
          products?.[0]?.handle
        );

        const lightingProducts = products.filter((p) => {
          const text = `${p.title} ${p.description}`.toLowerCase();

          return (
            text.includes("led") ||
            text.includes("light") ||
            text.includes("rgb") ||
            text.includes("strip")
          );
        });

        const automationProducts = products.filter((p) => {
          const text = `${p.title} ${p.description}`.toLowerCase();

          return (
            text.includes("plug") ||
            text.includes("socket") ||
            text.includes("switch") ||
            text.includes("power")
          );
        });

        const sensorProducts = products.filter((p) => {
          const text = `${p.title} ${p.description}`.toLowerCase();

          return (
            text.includes("motion") ||
            text.includes("sensor") ||
            text.includes("detector")
          );
        });

        const controlProducts = products.filter((p) => {
          const text = `${p.title} ${p.description}`.toLowerCase();

          return (
            text.includes("remote") ||
            text.includes("ir") ||
            text.includes("controller")
          );
        });

        const matchedProducts = [
          lightingProducts[0],
          automationProducts[0],
          sensorProducts[0],
          controlProducts[0],
        ].filter(Boolean);

        console.log(
          "SMART ROOM MATCHES:",
          matchedProducts.map((p) => p.handle)
        );

        const uniqueProducts = Array.from(
          new Map(
            matchedProducts.map((p) => [p.handle, p])
          ).values()
        );

        console.log("MATCHED PRODUCTS:", uniqueProducts.length);

        console.log("AI USING PRODUCT SOURCE:", "getShopifyProducts endpoint");
        console.log("AI PRODUCT COUNT:", products.length);

        const productsForAI =
          uniqueProducts.length > 0
            ? uniqueProducts
            : products.slice(0, 10);

        console.log(
          "PRODUCTS FOR AI:",
          productsForAI.map((p) => p.handle)
        );

        productContext = productsForAI
          .slice(0, 10)
          .map((p) => {
            const price =
              p.priceRange?.minVariantPrice ||
              p.variants?.edges?.[0]?.node?.price ||
              {};

            return `Product: ${p.title || p.name}
        Price: ${price.currencyCode || "GBP"} ${price.amount || p.price || ""}
        Handle: ${p.handle || ""}
        Product URL: https://futuristekstore.com/products/${p.handle || ""}`;
          })
          .join("\n\n");

        console.log("AI PRODUCT CONTEXT:", productContext);
      } catch (err) {
        console.error("AI failed to load products:", err);
      }


        const openai = new OpenAI({
          apiKey: process.env.OPENAI_API_KEY,
        });

        console.log("🔥🔥🔥 PRODUCT CONTEXT LENGTH =", productContext.length);
        console.log("🔥🔥🔥 PRODUCT CONTEXT =", productContext);

        console.log("FINAL PRODUCT CONTEXT LENGTH:", productContext.length);
        console.log("FINAL PRODUCT CONTEXT:", productContext);

        const aiResponse = await openai.responses.create({
          model: "gpt-5.5",
        instructions: `
        You are Futuristek AI.

        Use ONLY the live Futuristek product data provided in PRODUCT_CONTEXT for real product names, prices, handles, and URLs.

        Do not invent products.
        Do not invent prices.
        Do not estimate prices.
        Do not say the catalogue is unavailable if PRODUCT_CONTEXT contains products.

        For any room/home setup request:
        - detect the room type and customer goal
        - create a premium futuristic concept
        For room setup requests, always recommend 2 to 4 different matching Futuristek products from PRODUCT_CONTEXT when at least 2 products are available.
        - avoid repeating the same product unless the customer asks for multiples
        - prefer variety: lighting, automation, control, sensors, convenience
        - do not recommend security products unless the customer asks for security
        - use exact product names and exact prices from PRODUCT_CONTEXT
        - calculate the total using exact prices only

        At the end, include hidden product handles exactly like this:

        [[PRODUCTS]]
        matching-product-handle-1
        matching-product-handle-2
        [[END_PRODUCTS]]

        Also include room preview exactly like this:

        [[ROOM_PREVIEW]]
        short cinematic room preview here
        [[END_ROOM_PREVIEW]]

        Do not mention these hidden tags to the customer.
        Return plain text only. No markdown headings, no asterisks, no tables.

        If only one matching product exists in PRODUCT_CONTEXT:
        - recommend it once only
        - do not duplicate it
        - explain how it fits the setup
        - creatively describe complementary non-product decor separately

        If multiple matching products exist:
        - combine them naturally into one cinematic smart-home setup

        Never repeat the same product twice.
        `,
      input: `
      Customer message:
      ${message}

      Live Futuristek product data:
      ${productContext}

      ${orderContext ? `Order context:\n${orderContext}` : ""}
      `,
        });

        const reply =
          aiResponse.output_text ||
          "Thanks for contacting Futuristek Support. How can we help you today?";

        return res.json({
          ok: true,
          reply,
        });
      } catch (error) {
        console.error("AI support error:", error);

        return res.status(500).json({
          ok: false,
          error: error.message || "Support assistant failed",
        });
      }
    });
  }
);

exports.generateRoomImage = onRequest(
  {
    secrets: [OPENAI_API_KEY],
    cors: true,
    timeoutSeconds: 300,
    memory: "1GiB",
  },
  async (req, res) => {
    try {
      const { prompt, imageBase64 } = req.body || {};

      if (!prompt) {
        return res.status(400).json({
          ok: false,
          error: "Missing prompt",
        });
      }

      const openai = new OpenAI({
        apiKey: OPENAI_API_KEY.value(),
      });

      let result;

      if (imageBase64) {
        const cleanedBase64 = imageBase64.replace(
          /^data:image\/\w+;base64,/,
          ""
        );

        const imageBuffer = Buffer.from(cleanedBase64, "base64");

        const imageFile = await toFile(imageBuffer, "room.png", {
          type: "image/png",
        });

        result = await openai.images.edit({
          model: "gpt-image-1",
          image: imageFile,
          prompt,
          size: "1024x1024",
        });
      } else {
        result = await openai.images.generate({
          model: "gpt-image-1",
          prompt,
          size: "1024x1024",
        });
      }

      return res.json({
        ok: true,
        imageBase64: result.data?.[0]?.b64_json || "",
      });
    } catch (error) {
      console.error("generateRoomImage error:", error);

      return res.status(500).json({
        ok: false,
        error: error?.message || "Image generation failed",
      });
    }
  }
);
    