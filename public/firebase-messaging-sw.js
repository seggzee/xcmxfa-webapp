// FILE: public/firebase-messaging-sw.js

console.log("[SW] firebase-messaging-sw.js loaded");

importScripts("https://www.gstatic.com/firebasejs/10.8.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.8.1/firebase-messaging-compat.js");

console.log("[SW] Firebase compat scripts imported");

firebase.initializeApp({
  apiKey: "AIzaSyBXRSonEWClQXfshYVtAofY7sC73LUytH8",
  authDomain: "xcmxfa-app-386a7.firebaseapp.com",
  projectId: "xcmxfa-app-386a7",
  messagingSenderId: "952503499832",
  appId: "1:952503499832:web:deafaf4ca8c8115ae17acd"
});

console.log("[SW] Firebase initialized");

const messaging = firebase.messaging();

console.log("[SW] Firebase messaging instance created");

/* =========================================
   RAW PUSH EVENT
========================================= */
self.addEventListener("push", function (event) {
  console.log("[SW] raw push event fired", event);

  if (event.data) {
    try {
      console.log("[SW] raw push event text", event.data.text());
    } catch (err) {
      console.error("[SW] raw push event text read failed", err);
    }
  } else {
    console.log("[SW] raw push event has no data");
  }
});

/* =========================================
   FIREBASE BACKGROUND MESSAGE
========================================= */
messaging.onBackgroundMessage(function (payload) {
  console.log("[SW] onBackgroundMessage fired", payload);

  const title = payload?.data?.title || "Notification";
  const unreadCount = Number(payload?.data?.unread_count || 0);

  const options = {
    body: payload?.data?.body || "",
    icon: "/icon-192.png",
    data: payload?.data || {}
  };

  console.log("[SW] showNotification about to run", {
    title,
    options,
    unreadCount
  });

  // Exact badge update for app closed/backgrounded state.
  if (typeof self.navigator !== "undefined") {
    try {
      if (unreadCount > 0 && typeof self.navigator.setAppBadge === "function") {
        self.navigator.setAppBadge(unreadCount);
        console.log("[SW] setAppBadge", unreadCount);
      } else if (unreadCount <= 0 && typeof self.navigator.clearAppBadge === "function") {
        self.navigator.clearAppBadge();
        console.log("[SW] clearAppBadge");
      }
    } catch (err) {
      console.error("[SW] badge update failed", err);
    }
  }

  self.registration.showNotification(title, options)
    .then(function () {
      console.log("[SW] showNotification success");
    })
    .catch(function (err) {
      console.error("[SW] showNotification failed", err);
    });
});

/* =========================================
   CLICK HANDLER
========================================= */
self.addEventListener("notificationclick", function (event) {
  console.log("[SW] notificationclick fired", event);

  event.notification.close();

  const targetUrl = event.notification?.data?.url || "/";

  console.log("[SW] notificationclick targetUrl", targetUrl);

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true })
      .then(function (clientList) {
        console.log("[SW] existing clients", clientList);

        for (const client of clientList) {
          if (client.url.includes(targetUrl) && "focus" in client) {
            console.log("[SW] focusing existing client", client.url);
            return client.focus();
          }
        }

        if (clients.openWindow) {
          console.log("[SW] opening new window", targetUrl);
          return clients.openWindow(targetUrl);
        }

        console.log("[SW] no openWindow available");
      })
      .catch(function (err) {
        console.error("[SW] notificationclick error", err);
      })
  );
});

/* =========================================
   NOTIFICATION CLOSE
========================================= */
self.addEventListener("notificationclose", function (event) {
  console.log("[SW] notificationclose fired", event);
});

/* =========================================
   PUSH SUBSCRIPTION CHANGE
========================================= */
self.addEventListener("pushsubscriptionchange", function (event) {
  console.log("[SW] pushsubscriptionchange fired", event);
});

/* =========================================
   LIFECYCLE DEBUG
========================================= */
self.addEventListener("install", function (event) {
  console.log("[SW] install event", event);
});

self.addEventListener("activate", function (event) {
  console.log("[SW] activate event", event);
});

self.addEventListener("message", function (event) {
  console.log("[SW] message event", event.data);
});