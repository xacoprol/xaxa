# X — Gestión familiar del hogar

App privada para un hogar (familia): **Gastos**, **Menús con IA** e **Hipoteca**.

Stack: **Next.js 14 (App Router) · TypeScript · Tailwind · Prisma · PostgreSQL (Neon) · Supabase Auth/Storage · OpenAI**.

## Estructura

```
src/
  app/
    (auth)/          # login, register, onboarding
    (app)/           # dashboard, gastos, menus, hipoteca
    api/             # REST handlers
  components/
    ui/              # button, input, select…
    expenses/ menus/ mortgage/ layout/
  lib/
    auth.ts prisma.ts supabase/ expenses/ menus/ constants.ts
prisma/
  schema.prisma
```

## Arranque

1. Copia variables de entorno:

```bash
cp .env.example .env
```

2. Rellena en `.env`:
   - Supabase Auth: `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` (legacy `eyJ…`)
   - Neon: `DATABASE_URL` (pooled, host con `-pooler`) y `DIRECT_URL` (directa)
   - `OPENAI_API_KEY`
   - `NEXT_PUBLIC_APP_URL`

3. En Supabase: Auth email/password + Storage bucket `mortgage-attachments`.

4. Aplica schema en Neon y arranca:

```bash
npm install
npm run db:generate
npm run db:push
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000).

## Flujo de uso

1. **Registro** → **Onboarding** (crear hogar o unirse con código).
2. El admin recibe categorías de gasto por defecto.
3. **Dashboard**: gasto del mes, menú de hoy, pendiente de hipoteca.
4. **Gastos**: CRUD, reparto %, balance “quién debe a quién”, gráfico Recharts, export CSV.
5. **Menús**: preferencias → generar semana (OpenAI + fotos) → regenerar un día → favoritos persistentes → lista de la compra.
6. **Hipoteca**: timeline + adjuntos en Storage + ficha fija editable.

## Notas Supabase Storage

Buckets recomendados:

- `mortgage-attachments` — adjuntos de hipoteca
- `meal-images` — fotos de platos generadas por IA

Política mínima (público de lectura, auth/service de escritura) — ajústala a tu seguridad:

```sql
-- Ejemplo orientativo; revisa RLS en tu proyecto
insert into storage.buckets (id, name, public) values ('mortgage-attachments', 'mortgage-attachments', true);
insert into storage.buckets (id, name, public) values ('meal-images', 'meal-images', true);
```

## Scripts

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Desarrollo |
| `npm run db:push` | Sincroniza schema → Postgres |
| `npm run db:migrate` | Migraciones versionadas |
| `npm run db:studio` | Prisma Studio |
