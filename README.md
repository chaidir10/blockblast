# Block Blast Premium

Game puzzle Block Blast berbasis HTML/CSS/JS murni dengan kualitas mobile premium.

## File Structure

```
blockblast/
├── index.html       # Halaman utama game
├── style.css        # Semua styling (glassmorphism, animasi, responsive)
├── game.js          # Engine game lengkap
├── manifest.json    # PWA manifest
├── sw.js            # Service Worker untuk offline & PWA
├── icons/           # App icons (PNG, berbagai ukuran)
└── README.md        # Dokumentasi ini
```

## Cara Menjalankan

1. **Buka langsung**: Buka `index.html` di browser modern (Chrome, Safari, Firefox)
2. **Web server** (direkomendasikan untuk PWA): 
   ```bash
   npx serve .
   # atau
   python3 -m http.server 8080
   ```
3. **Install sebagai PWA**: Setelah dibuka via web server HTTPS, tap "Add to Home Screen"

## Fitur

- ✅ Drag & drop blok (presisi tinggi, offset atas jari)
- ✅ 29 bentuk blok berbeda
- ✅ Clear baris & kolom + sistem combo
- ✅ Animasi partikel & float score
- ✅ 5 Power-Up unlimited: Bomb, Hammer, Shuffle, Undo, Clear Line
- ✅ High score persistent (localStorage)
- ✅ PWA fullscreen (manifest + service worker)
- ✅ Responsive desktop & mobile
- ✅ Animated starfield background
- ✅ Glassmorphism dark cosmic theme

## Cara Install di HP

1. Buka game via Chrome/Safari di alamat HTTPS
2. Chrome Android: Menu (⋮) → "Add to Home Screen"
3. Safari iOS: Share (⬆) → "Add to Home Screen"
4. Game akan terbuka fullscreen seperti aplikasi native
