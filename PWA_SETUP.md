# PWA Setup Guide - SyncNote

SyncNote adalah sebuah **Progressive Web App (PWA)** yang dapat diinstal di perangkat apa pun dengan fitur:
- ✅ Installable di home screen (seperti native app)
- ✅ Offline-first dengan service worker caching
- ✅ Background sync untuk notes
- ✅ Push notifications support
- ✅ Works on mobile, tablet, desktop

## Fitur PWA yang Sudah Aktif

### 1. **Web App Manifest** (`public/manifest.json`)
- App name, icons, theme colors
- Share target (menerima text/links dari apps lain)
- App shortcuts untuk quick actions

### 2. **Service Worker** (`public/service-worker.js`)
- **Cache Strategy**: 
  - Static assets: Cache-first (images, fonts, CSS)
  - HTML/API: Network-first dengan cache fallback
  - Firebase requests: Always network (no cache)
- **Offline Support**: App shell caching
- **Background Sync**: Sync notes saat connection restored
- **Push Notifications**: Ready untuk receive notifications

### 3. **PWA Meta Tags** (index.html)
- `manifest.json` link
- Apple iOS support (apple-mobile-web-app-capable)
- Status bar styling
- Custom app name dan icon

## Setup Steps

### Step 1: Generate PWA Icons (Recommended)

App memerlukan PNG icons untuk installation, app drawer, dan notifications.

**Option A: Automatic (Recommended)**
```bash
npm install sharp
npm run pwa:icons
```

Ini akan generate:
- `icon-192.png` - Home screen icon
- `icon-512.png` - Splash screen & notifications
- `icon-192-maskable.png` - Safe area untuk adaptive icons
- `icon-512-maskable.png` - Large adaptive icon

**Option B: Manual**
1. Open favicon.svg in image editor (Figma, Photoshop, etc.)
2. Export as PNG:
   - 192x192 → `public/icon-192.png`
   - 512x512 → `public/icon-512.png`
   - Repeat cho maskable versions

### Step 2: Generate Screenshots (Optional but Recommended)

PWA install dialog menampilkan screenshots untuk better UX:
1. Ambil screenshot app di mobile (540x720)
2. Simpan ke `public/screenshot-1.png`
3. Desktop (1280x720) → `public/screenshot-2.png`

### Step 3: Deploy with HTTPS

Service worker **hanya bekerja di HTTPS** (atau localhost untuk dev).

**Development:**
```bash
npm run dev  # Localhost:3000 - Service worker aktif
```

**Production:**
- Deploy ke server dengan SSL/TLS certificate
- Service worker akan auto-register

## Testing PWA

### Chrome/Edge DevTools
1. Open DevTools (F12)
2. Go to **Application** tab
3. Check **Manifest** section:
   - ✅ Valid manifest.json
   - ✅ Icon URLs accessible
   - ✅ Theme colors

4. Check **Service Worker**:
   - ✅ Status: Active & running
   - ✅ Scope: /
   - ✅ Updates: every 24 hours

### Install Test
1. Buka app di browser
2. Click address bar → "Install SyncNote" button
3. Confirm install
4. App muncul di home screen/app drawer

### Offline Test
1. Install app
2. Open DevTools → Network
3. Throttle ke "Offline"
4. Close & reopen app → Phải vẫn load (app shell)
5. Note data từ cache (nếu đã load sebelumnya)

## Troubleshooting

### Service Worker Not Registering
**Check:**
- Is HTTPS or localhost? (Service Worker requires secure context)
- Is service-worker.js accessible at `/service-worker.js`?
- Check DevTools → Application → Service Worker for errors

### Icons Not Showing
**Check:**
- Files exist: `public/icon-192.png`, `public/icon-512.png`
- URLs in manifest.json correct
- Image format is PNG (not SVG for install icons)

### Offline Not Working
**Check:**
- Service Worker status: Active & running
- Network panel: CSS/JS should be cached
- Firebase requests: Should fail gracefully (not cached)

### Cache Not Updating
**Clear cache:**
1. DevTools → Application → Cache Storage
2. Delete `syncnote-v1` cache
3. Reload page → Service Worker reinstalls

## PWA Capabilities Roadmap

| Feature | Status | Notes |
|---------|--------|-------|
| Installation | ✅ Ready | Works on all browsers |
| Offline Shell | ✅ Ready | App shell caches |
| Offline Notes | ⏳ Partial | Cached notes visible, no local write |
| Sync on Online | ⏳ Ready | Background sync set up |
| Push Notifications | ✅ Ready | Needs backend integration |
| Share Target | ✅ Ready | Can receive text/links from other apps |
| App Shortcuts | ✅ Ready | "Create New Note" shortcut |

## Files Changed

- ✅ `public/manifest.json` - Web App Manifest
- ✅ `public/service-worker.js` - Service Worker logic
- ✅ `index.html` - PWA meta tags + SW registration
- ✅ `package.json` - Added `pwa:icons` script
- ✅ `scripts/generate-pwa-icons.js` - Icon generator

## Next Steps

1. **Generate icons**: `npm run pwa:icons`
2. **Test locally**: `npm run dev` → Open DevTools → Application tab
3. **Test install**: Click "Install SyncNote" in address bar
4. **Generate screenshots**: Capture app UI for better install dialog
5. **Deploy**: Push to HTTPS server for production PWA

## References

- [MDN: Progressive Web Apps](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps)
- [Web.dev: Install prompt](https://web.dev/customize-install/)
- [PWA Checklist](https://www.pwatoolbox.com/checklist)
