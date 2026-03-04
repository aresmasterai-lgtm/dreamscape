# ✦ Dreamscape

> Artist Social Media · AI Creation · Global Marketplace

Built with React + Vite. Deploys to Netlify in minutes.

---

## 🚀 Deploy to Netlify via GitHub

### Step 1 — Push this repo to GitHub

```bash
# In your terminal, navigate to this folder, then:
git init
git add .
git commit -m "Initial Dreamscape commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/dreamscape.git
git push -u origin main
```

### Step 2 — Connect to Netlify

1. Go to [app.netlify.com](https://app.netlify.com)
2. Click **"Add new site"** → **"Import an existing project"**
3. Choose **GitHub** and authorize Netlify
4. Select your **dreamscape** repository
5. Netlify will auto-detect these settings (already in `netlify.toml`):
   - **Build command:** `npm run build`
   - **Publish directory:** `dist`
6. Click **"Deploy site"**

That's it — Netlify will build and deploy automatically. ✅

---

## 🔑 Environment Variables (Anthropic API Key)

Ares AI uses the Anthropic API. You need to add your API key in Netlify:

1. In your Netlify site dashboard → **Site configuration** → **Environment variables**
2. Add:
   ```
   Key:   VITE_ANTHROPIC_API_KEY
   Value: sk-ant-your-key-here
   ```
3. Redeploy the site

> ⚠️ **Important:** The current build calls the Anthropic API directly from the browser.
> For production, move API calls to a Netlify Function (serverless) to keep your key safe.
> See `/netlify/functions/` setup below.

---

## ⚡ Netlify Functions (Secure API calls — recommended)

Create `netlify/functions/ares.js`:

```js
exports.handler = async (event) => {
  const { messages } = JSON.parse(event.body);
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      system: "You are Ares, the Dreamscape AI assistant...",
      messages,
    }),
  });
  const data = await response.json();
  return { statusCode: 200, body: JSON.stringify(data) };
};
```

Then in your React component, call `/.netlify/functions/ares` instead of the Anthropic API directly.

---

## 🌐 Custom Domain

1. Netlify dashboard → **Domain management** → **Add custom domain**
2. Add your domain (e.g. `dreamscape.app`)
3. Update your DNS nameservers to Netlify's (shown in dashboard)
4. SSL is automatic and free via Let's Encrypt ✅

---

## 🔄 Auto-Deploy

Every `git push` to `main` triggers a new Netlify build automatically.

```bash
# Make changes, then:
git add .
git commit -m "Update channels"
git push
# Netlify auto-deploys in ~1 minute
```

---

## 🛠️ Local Development

```bash
npm install
npm run dev
# Open http://localhost:5173
```

---

## 📁 Project Structure

```
dreamscape/
├── public/
│   └── favicon.svg
├── src/
│   ├── main.jsx        ← React entry point
│   └── App.jsx         ← Full Dreamscape app
├── index.html          ← SEO meta tags here
├── vite.config.js
├── netlify.toml        ← Build + redirect config
├── package.json
└── .gitignore
```

---

## 🔌 Integrations Roadmap

| Integration | Status | Notes |
|-------------|--------|-------|
| Ares AI (Claude) | ✅ Live | Move to Netlify Function for production |
| Printful API | 🔜 Next | Product sync, order management |
| Stripe | 🔜 Next | Artist payouts, marketplace fees |
| Supabase | 🔜 Next | User auth, profiles, channel posts |
| Cloudinary | 🔜 Next | AI-generated image storage |

---

Built with ❤️ by Kingsley · Powered by Anthropic + Printful
