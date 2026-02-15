# Pre-Deploy Checklist

## 1. Local Run
- [ ] Run `npm install`
- [ ] Run `npm run dev`
- [ ] Confirm app is running on `http://localhost:3000`
- [ ] Check console for runtime errors or broken imports

## 2. Page Rendering Verification
Verify all these pages load correctly:
- [ ] `/` (Home)
- [ ] `/login`
- [ ] `/about`
- [ ] `/blog`
- [ ] `/stories`
- [ ] `/jobs`
- [ ] `/terms`
- [ ] `/privacy`
- [ ] `/usage`

## 3. Click-through Verification (Homepage)
**Header:**
- [ ] "تسجيل الدخول" -> goes to `/login`
- [ ] Language toggle works
- [ ] "الأسعار" -> scrolls to Pricing section
- [ ] "كيف يعمل" -> scrolls to How it Works section

**Hero:**
- [ ] "احصل على تقرير مجاني" -> goes to `/login`
- [ ] "شاهد كيف يعمل" -> scrolls to How It Works section

**Trust/Platforms:**
- [ ] Wording says "متوافق..."
- [ ] Wording says "حاليًا عبر CSV..."
- [ ] No "Official Partnership" claims

**Pricing:**
- [ ] Default state: Middle plan ("النمو") is featured (elevated + green button)
- [ ] Hover effect: Hovering a card makes it the *only* featured card
- [ ] Mouse leave: Returns to default state (Middle plan featured)
- [ ] Alignment: Cards stay aligned, no card stuck elevated
- [ ] Disclaimer visible: "يتم تجديد الاشتراك تلقائيًا..."
- [ ] Free trial text: "تحليلان مجانيان..."
- [ ] NO 14-day trial mention

**Footer:**
- [ ] All links work (no 404s)
- [ ] Commercial Register card is EXACTLY centered horizontally
- [ ] Commercial Register image loads correctly

## 4. Build Verification
- [ ] Run `npm run build`
- [ ] Ensure build succeeds (exit code 0)
- [ ] No hydration warnings
- [ ] No missing imports
