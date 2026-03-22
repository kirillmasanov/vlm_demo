# VLM Demo — Yandex Cloud AI Studio

Веб-приложение для демонстрации возможностей визуальных и генеративных моделей в Yandex Cloud AI Studio.

## Возможности

### Gemma 3 27B — анализ изображений
- Выбор одного или нескольких предустановленных изображений
- Загрузка собственных изображений
- Текстовый запрос к мультимодальной модели
- Форматированный ответ с поддержкой Markdown
- Просмотр сырого JSON-ответа API

### YandexART — генерация изображений
- Генерация изображений по текстовому описанию
- Настройка соотношения сторон (1:1, 16:9, 9:16, 3:2, 2:3)
- Опциональный параметр seed для воспроизводимости
- Просмотр сырого JSON-ответа API

## Технологии

- **Backend:** FastAPI, Python 3.12
- **Frontend:** HTML, CSS, JavaScript
- **API:** Yandex Cloud AI Studio (OpenAI-совместимый API для Gemma, REST API для YandexART)
- **Зависимости:** uv

## Быстрый старт

### Предварительные требования

- Python 3.12+
- [uv](https://docs.astral.sh/uv/)
- API-ключ Yandex Cloud с доступом к AI Studio
- ID каталога (folder) в Yandex Cloud

### Настройка

1. Клонируйте репозиторий:

```bash
git clone <repo-url>
cd vlm_demo
```

2. Создайте файл `.env`:

```env
YANDEX_API_KEY=<ваш API-ключ>
YANDEX_FOLDER_ID=<ID каталога>
```

3. Установите зависимости и запустите:

```bash
uv sync
uv run uvicorn app.main:app --reload
```

4. Откройте http://localhost:8000

### Запуск через Docker

```bash
docker compose up --build
```

## Полезные ссылки

- [Completions API. Отправить запрос мультимодальной модели](https://aistudio.yandex.ru/docs/ru/ai-studio/operations/generation/multimodels-request.html)
- [Сгенерировать изображение с помощью YandexART](https://aistudio.yandex.ru/docs/ru/ai-studio/operations/generation/yandexart-request.html)
- [Image Generative API](https://aistudio.yandex.ru/docs/ru/ai-studio/image-generation/api-ref/)
- [Правила тарификации](https://aistudio.yandex.ru/docs/ru/ai-studio/pricing.html#common-instance-sync)
