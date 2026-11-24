# Fridgeful
Photo of ingredients -> recipe list -> saved recipe -> step-by-step cooking with timers. `public/` is the whole app: static files, no server code, no keys.

- Try on this Mac: `python3 -m http.server 8765 --directory public`, then open http://localhost:8765
- Phones need HTTPS: upload `public/` to any static host (e.g. GitHub Pages, Netlify), open it on the phone, then Add to Home Screen.
- Tests (uses live recipe sites): `node tools/test.mjs`
- Change recognizable foods: edit `tools/labels.mjs`, then `cd tools && npm install && node build-embeddings.mjs`

Recipes: TheMealDB (its public key "1" is for development/education; get a supporter key before releasing publicly) and Wikibooks Cookbook (CC BY-SA). Image model: Apple MobileCLIP-S0, converted by Xenova; check Apple's license before commercial use.
