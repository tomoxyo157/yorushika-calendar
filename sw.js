// Listener untuk menangkap event push notification dari server/FCM
self.addEventListener('push', function (event) {
    let data = {
        title: 'Yorushika Calendar',
        body: 'Ada pengingat baru untukmu!',
        icon: '/icon.png', // Pastikan path icon sudah sesuai
        url: '/'
    };

    if (event.data) {
        try {
            data = event.data.json();
        } catch (e) {
            data.body = event.data.text();
        }
    }

    const options = {
        body: data.body,
        icon: data.icon || '/icon.png',
        badge: '/badge.png', // Opsional: icon kecil di status bar Android
        data: {
            url: data.url || '/'
        }
    };

    event.waitUntil(
        self.registration.showNotification(data.title, options)
    );
});

// Listener ketika user mengklik notifikasi
self.addEventListener('notificationclick', function (event) {
    event.notification.close();

    const targetUrl = event.notification.data.url || '/';

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (windowClients) {
            // Cek apakah tab web app sudah terbuka, jika ya fokuskan
            for (let i = 0; i < windowClients.length; i++) {
                let client = windowClients[i];
                if (client.url === targetUrl && 'focus' in client) {
                    return client.focus();
                }
            }
            // Jika belum terbuka, buka window/tab baru ke URL target
            if (clients.openWindow) {
                return clients.openWindow(targetUrl);
            }
        })
    );
});