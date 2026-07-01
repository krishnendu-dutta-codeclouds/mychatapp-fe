/**
 * Standard utility wrapper for HTML5 Web Notifications API.
 * Handles permission checks and showing browser-level desktop push notifications.
 */

// Request permission to show notifications
export function requestNotificationPermission() {
  if (!("Notification" in window)) {
    console.warn("This browser does not support desktop notifications.");
    return;
  }

  if (Notification.permission !== "granted" && Notification.permission !== "denied") {
    Notification.requestPermission().then((permission) => {
      console.log(`Notification permission status: ${permission}`);
    });
  }
}

// Show a desktop notification
export function showNotification(title, options = {}) {
  if (!("Notification" in window)) return null;
  if (Notification.permission !== "granted") return null;

  try {
    const defaultOptions = {
      icon: '/logo192.png', // Fallback to React app default logo icon
      badge: '/logo192.png',
      silent: false,
      tag: 'talkzen-notification',
      renotify: true,
      ...options
    };

    const notification = new Notification(title, defaultOptions);

    // Auto-focus the browser window on click
    notification.onclick = (e) => {
      e.preventDefault();
      window.focus();
      if (options.onClick) {
        options.onClick(notification);
      }
      notification.close();
    };

    return notification;
  } catch (err) {
    console.error("Failed to show desktop notification:", err);
    return null;
  }
}
