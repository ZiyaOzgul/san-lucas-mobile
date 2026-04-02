# San Lucas Cafe Mobile — CLAUDE.md

## Project Overview
Mobile companion app for the San Lucas Cafe POS system. Built with Expo + React Native. Connects to the **same Supabase project** as the desktop app — same database, same tables, no schema changes. Supports authentication with role-based access control (admin / waiter).

---

## Tech Stack
- **Expo SDK ~54** — mobile framework
- **React Native 0.81.5** — UI
- **Expo Router ~6** — file-based routing
- **Supabase JS Client** — same project as desktop (database + realtime + auth)
- **AsyncStorage** — session persistence across app restarts
- **react-native-size-matters** — responsive sizing (no hardcoded pixels)
- **react-native-reanimated** — animations
- **Custom StyleSheet only** — no NativeWind, no styled-components, no UI libraries
- **@expo/vector-icons (Ionicons)** — tab bar icons

---

## Folder Structure
```
san-lucas-mobile/
├── app/
│   ├── _layout.jsx          # Root layout — wraps app in AuthProvider
│   ├── index.jsx            # Entry point — redirects to login or tabs
│   ├── login.jsx            # Login screen
│   └── (tabs)/
│       ├── _layout.jsx      # Tab navigator — role-based tab visibility
│       ├── tables.jsx       # Masalar (admin + waiter)
│       ├── orders.jsx       # Siparişler (admin + waiter)
│       ├── products.jsx     # Ürünler (admin only)
│       ├── reports.jsx      # Raporlar (admin only)
│       └── settings.jsx     # Ayarlar (admin only)
├── components/
│   ├── TableCard.jsx
│   ├── OrderPanel.jsx
│   ├── CloseTableModal.jsx
│   └── shared/
│       ├── Button.jsx
│       └── Badge.jsx
├── lib/
│   ├── supabase.js          # Supabase client (AsyncStorage session)
│   └── auth.js              # signIn, signOut, getProfile, getSession
├── hooks/
│   ├── useAuth.js           # AuthContext provider + useAuth hook
│   ├── useTables.js         # Tables fetch + realtime subscription
│   ├── useOrders.js         # Orders CRUD + realtime subscription
│   └── useProducts.js       # Products + categories CRUD
├── styles/
│   ├── colors.js            # Design tokens (matches desktop exactly)
│   └── spacing.js           # scale/verticalScale/moderateScale helpers
├── .env
└── CLAUDE.md
```

---

## Database Schema (Supabase — shared with desktop)

```sql
create table tables (
  id serial primary key,
  name text not null,
  status text default 'empty', -- 'empty' | 'occupied'
  created_at timestamp default now()
);

create table categories (
  id serial primary key,
  name text not null,
  color text default '#e8975a'
);

create table products (
  id serial primary key,
  name text not null,
  price decimal(10,2) not null,
  stock integer default 0,
  category_id integer references categories(id),
  image_url text,
  is_active boolean default true,
  created_at timestamp default now()
);

create table orders (
  id serial primary key,
  local_id text unique,
  table_id integer references tables(id),
  status text default 'active', -- 'active' | 'completed' | 'cancelled'
  payment_method text,          -- 'cash' | 'card'
  total decimal(10,2) default 0,
  is_synced boolean default false,
  created_at timestamp default now(),
  closed_at timestamp
);

create table order_items (
  id serial primary key,
  local_id text unique,
  order_id integer references orders(id),
  product_id integer references products(id),
  quantity integer not null,
  unit_price decimal(10,2) not null,
  is_synced boolean default false
);

create table profiles (
  id uuid references auth.users(id) primary key,
  full_name text,
  role text default 'waiter', -- 'admin' | 'waiter'
  created_at timestamp default now()
);
```

---

## Environment Variables (`.env`)
```
EXPO_PUBLIC_SUPABASE_URL=https://gscuotgjxmcemmkbajtd.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_vdjkjwNE6BjFzhV6O6Gtog_sIzAEEA5
```
Always use `EXPO_PUBLIC_` prefix for variables that need to be accessible in the app bundle.

---

## Design System

Defined in `styles/colors.js`. Use everywhere — zero hardcoded colors.

```js
export const colors = {
  bgPage: '#f5f5f0',
  bgCard: '#ffffff',
  bgNavbar: '#ffffff',
  accent: '#e8975a',
  accentHover: '#d4824a',
  accentLight: '#fdf0e8',
  success: '#22c55e',
  successLight: '#dcfce7',
  danger: '#ef4444',
  dangerLight: '#fee2e2',
  warning: '#f59e0b',
  warningLight: '#fef3c7',
  textPrimary: '#1a1a2e',
  textSecondary: '#6b7280',
  textMuted: '#9ca3af',
  border: '#e5e7eb',
};
```

---

## Responsive Sizing

All sizing uses `react-native-size-matters`. **Never use hardcoded pixel values.**

```js
import { scale, verticalScale, moderateScale } from 'react-native-size-matters';
```

| Function | Use for |
|---|---|
| `scale()` | Horizontal dimensions, width, paddingLeft/Right |
| `verticalScale()` | Vertical dimensions, height, paddingTop/Bottom |
| `moderateScale()` | Font sizes, border radius, icon sizes |

---

## Authentication Flow

```
App opens
  ↓
AuthProvider checks Supabase session (via AsyncStorage)
  ↓
app/index.jsx → redirects based on session
  ↓
No session → /login
Session exists → /(tabs)/tables
  ↓
Login: email + password → Supabase Auth
  ↓
Fetch role from profiles table
  ↓
role = 'admin'  → full app (5 tabs)
role = 'waiter' → limited app (2 tabs)
```

---

## Role Permissions

| Screen       | Admin | Waiter |
|--------------|-------|--------|
| Masalar      | ✓     | ✓      |
| Siparişler   | ✓     | ✓      |
| Ürünler      | ✓     | ✗      |
| Raporlar     | ✓     | ✗      |
| Ayarlar      | ✓     | ✗      |

Admin-only tabs have `href: null` for waiter role in `(tabs)/_layout.jsx`.
Each admin-only screen also renders an access-denied message if role check fails.

---

## Navigation Structure

Bottom tab navigator via Expo Router `<Tabs>`.

**Waiter:** Masalar · Siparişler
**Admin:** Masalar · Siparişler · Ürünler · Raporlar · Ayarlar

Stack screens: `index` (redirect) → `login` → `(tabs)`

---

## Realtime

Subscribed to `orders` and `order_items` table changes via Supabase Realtime channels.
- `useTables.js` — refreshes table list on any order/table change
- `useOrders.js` — refreshes order list per filter on any order/order_items change
Channels are cleaned up on component unmount via `supabase.removeChannel()`.

---

## Coding Rules

1. **No UI libraries.** Every style is handwritten `StyleSheet.create()`.
2. **No hardcoded colors.** Always import from `styles/colors.js`.
3. **No hardcoded pixel values.** Always use `scale()`, `verticalScale()`, or `moderateScale()`.
4. **Currency**: always use `₺` symbol.
5. **Locale**: all dates/times formatted with `tr-TR` locale.
6. **Supabase keys**: always in `.env` with `EXPO_PUBLIC_` prefix, never hardcoded.
7. **Role check**: every admin-only screen must check `isAdmin` from `useAuth()`.
8. **Session persistence**: Supabase client uses AsyncStorage — session survives app restarts.
9. **Logout**: calls `signOut()` from `lib/auth.js`, then `router.replace('/login')`.
10. **No offline support**: mobile is online-only. No sql.js, no sync logic.
11. **local_id**: generate `crypto.randomUUID()` for every new order and order_item.
12. **No register screen**: admin creates user accounts via Supabase dashboard directly.
