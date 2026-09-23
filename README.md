# 🗺️ GPS Track Finder

**Поиск GPS-треков автопутешествий** на форумах, чатах и сайтах автомобильных путешественников.

![Next.js](https://img.shields.io/badge/Next.js-16-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4)
![Vercel](https://img.shields.io/badge/Vercel-Ready-black)

## Возможности

- 🔍 **Поиск по 10+ ресурсам** — 4x4forum.ru, drive2.ru, forum.autotravel.ru, expedition.ru, wikiloc, klimovs-travels.ru, ttrails.ru, trekkingmania.ru и др.
- 🎯 **Умная фильтрация** — отсеивает шум (музыка, товары, тех. статьи), ранжирует по релевантности
- ✅ **Проверка ссылок** — проверяет доступность каждого трека для скачивания
- 📦 **Форматы GPX/KMZ/KML** — определяет формат и показывает бейдж
- 🏔️ **10 популярных направлений** — Алтай, Кавказ, Карелия, Кольский, Дагестан, Урал, Байкал, Камчатка, Саяны, Якутия
- 🌑 **Тёмная тема** — стильный UI с акцентом amber/gold

## Технологии

- **Next.js 16** (App Router, Server Actions)
- **TypeScript** (strict mode)
- **Tailwind CSS 4**
- **Lucide React** (icons)
- **Vercel** (deployment)

## Быстрый старт

```bash
# Установка
npm install

# Разработка
npm run dev

# Production build
npm run build
npm start
```

Откройте [http://localhost:3000](http://localhost:3000) в браузере.

## API

### `POST /api/search`

Поиск GPS-треков по региону.

**Request:**
```json
{
  "region": "Алтай",
  "limit": 10,
  "verify": true
}
```

**Response:**
```json
{
  "region": "Алтай",
  "tracks": [
    {
      "title": "Ороктойская Тропа, Горный Алтай",
      "source": "wikiloc.com",
      "url": "https://ru.wikiloc.com/...",
      "downloadUrl": null,
      "format": null,
      "available": true,
      "needsRegistration": false,
      "relevanceScore": 5.2
    }
  ],
  "totalFound": 16,
  "totalAvailable": 8,
  "searchTimeSeconds": 25.3
}
```

## Ресурсы для поиска

| Ресурс | Приоритет | Регистрация | Описание |
|--------|-----------|-------------|----------|
| 4x4forum.ru | 1 | Да | Крупнейший форум внедорожников |
| drive2.ru | 2 | Нет | Крупнейшее автосообщество РФ |
| forum.autotravel.ru | 3 | Да | Форум автопутешественников |
| expedition.ru | 4 | Да | Форум экспедиций |
| klimovs-travels.ru | 5 | Нет | GPS-треки экспедиций Климова |
| wikiloc.com | 6 | Нет | Международная база треков |
| ttrails.ru | 7 | Нет | Тропинки.ру — маршруты с GPX |
| trekkingmania.ru | 8 | Нет | Путеводители с треками |
| ykoctpa.ru | 9 | Нет | У костра — GPS-треки и навигация |
| VK | 10 | Нет | Группы автопутешественников |

## Деплой на Vercel

Проект готов к деплою на Vercel:

1. Зайдите на [vercel.com](https://vercel.com)
2. Импортируйте репозиторий `Wasp1977/trckfndr`
3. Нажмите **Deploy**

Никаких дополнительных переменных окружения не требуется.

> **Примечание:** Для работы поиска в production-среде Vercel необходимо настроить доступ к web search API. Это можно сделать через переменную окружения `SEARCH_API_URL`, либо развернуть собственный search proxy.

## Структура проекта

```
src/
├── app/
│   ├── api/search/route.ts   — API endpoint для поиска
│   ├── globals.css           — Global styles + animations
│   ├── layout.tsx            — Root layout (dark theme)
│   └── page.tsx              — Main search UI
└── lib/
    └── tracks.ts             — Core logic (resources, scoring, filtering)
```

## Лицензия

MIT
