# 💰 КЭШ.СТРИМ — симулятор фрилансера в стиле Windows 95

> «Зарабатывай, пока не выгорел. Или пока не разбогател.»

**Версия 0.2.3** · Chrome Extension (Manifest V3) + полноэкранный рабочий стол

---

## Как играть (3 шага)

1. **Установите расширение** → иконка КЭШ.СТРИМ → **«Открыть рабочий стол»**.  
2. **Пройдите обучение** (или «Пропустить») — до этого время на паузе, окна закрыты.  
3. **Биржа.exe** → возьмите заказ → **Работа.exe** — кликайте и сдавайте этапы.

Сохраняйте прогресс: автоматически на этом ПК; в **Настройка.exe** — облако, экспорт JSON или сброс.

---

## Описание

Кликер / симулятор жизни фрилансера: биржа заказов, штат (стажёры и PM), инвестиции, банк, казино, налоги, кризисы и выгорание. Интерфейс — ностальгический Windows 95.

## Установка (разработка)

1. `chrome://extensions` → «Режим разработчика»  
2. «Загрузить распакованное» → папка `game/`  
3. Popup — по иконке; полный стол — кнопка в popup (откроет `fullpage.html` из расширения)

## Карточка Chrome Web Store (черновик)

**Краткое описание (≤132 символа):**  
Симулятор фрилансера в стиле Windows 95: заказы, штат, инвестиции и выгорание.

**Как играть:**  
1) Откройте расширение и рабочий стол. 2) Пройдите обучение. 3) Биржа → заказ → Работа.

*Это игра-симулятор. Внутриигровые «деньги» и «налоги» не связаны с реальными финансами.*

---

## Облако (Supabase) — почему может «не работать»

Код умеет регистрировать пользователей и писать сейвы, но в репозитории по умолчанию:

```js
// core/cs-config.js
CS.CLOUD = {
  url: 'https://ВАШ_ПРОЕКТ.supabase.co',
  anonKey: 'ВСТАВЬТЕ_СЮДА_PUBLISHABLE_KEY'  // ← без реального ключа облако отключено
};
```

Пока `anonKey` — заглушка, UI показывает предупреждение, Auth/REST не вызываются с ключом.

### Чеклист

1. **Project Settings → API** → **Project URL** и **anon public** key в `CS.CLOUD`.  
   Не кладите `service_role` в расширение.
2. **Authentication → Providers** → Email. Если включено Confirm email — подтвердите почту после регистрации.
3. Таблица **`player_saves`** и RLS (SQL Editor):

```sql
create table if not exists public.player_saves (
  user_id uuid primary key references auth.users (id) on delete cascade,
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.player_saves enable row level security;

create policy "player_saves_select_own"
  on public.player_saves for select
  using (auth.uid() = user_id);

create policy "player_saves_insert_own"
  on public.player_saves for insert
  with check (auth.uid() = user_id);

create policy "player_saves_update_own"
  on public.player_saves for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

4. После входа нажмите **«Сохранить в облако»** — одна только регистрация сейв в таблицу не пишет, пока не сработает push/sync.  
5. Играйте **как расширение Chrome**, не через `file://`.

| Симптом | Причина |
|---------|---------|
| «Укажите Publishable key» | Заглушка в `cs-config.js` |
| Регистрация ок, сейв нет | Нет таблицы / RLS |
| «Проверьте почту» | Confirm email в Supabase |
| Google не входит | OAuth + redirect `chrome.identity` в Supabase |

---

## Локальный сейв

В **Настройка.exe**:

- **Экспорт JSON** — файл на диск  
- **Импорт JSON** — заменить прогресс  
- **Сбросить прогресс** — новый старт (облачный аккаунт не удаляется)

Ключ: `csState` в `chrome.storage.local` / `localStorage`.

## Документация

- [GAME_DESCRIPTION.md](GAME_DESCRIPTION.md) — системы и баланс  
- [update.md](update.md) — дорожная карта  

## Лицензия

Проект для обучения и развлечения. Используйте и модифицируйте свободно.
