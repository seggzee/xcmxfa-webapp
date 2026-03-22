// FILE: public/firebase-messaging-sw.js

importScripts("https://www.gstatic.com/firebasejs/10.8.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.8.1/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey:  "AIzaSyBXRSonEWClQXfshYVtAofY7sC73LUytH8",
  authDomain: "xcmxfa-app-386a7.firebaseapp.com",
  projectId: "xcmxfa-app-386a7",
  messagingSenderId: "952503499832",
  appId:  "1:952503499832:web:deafaf4ca8c8115ae17acd"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(function(payload) {
  const title = payload?.notification?.title || "Notification";
  const options = {
    body: payload?.notification?.body || "",
    icon: "/icon-192.png"
  };

  self.registration.showNotification(title, options);
});