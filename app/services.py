import os
import time

import httpx
from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()

YANDEX_API_KEY = os.environ["YANDEX_API_KEY"]
YANDEX_FOLDER_ID = os.environ["YANDEX_FOLDER_ID"]

client = OpenAI(
    api_key=YANDEX_API_KEY,
    base_url="https://ai.api.cloud.yandex.net/v1",
)

ART_HEADERS = {
    "Authorization": f"Api-Key {YANDEX_API_KEY}",
    "Content-Type": "application/json",
}


def query_gemma(images: list[str], prompt: str) -> dict:
    input_content: list[dict] = [{"type": "input_text", "text": prompt}]
    for img in images:
        input_content.append(
            {
                "type": "input_image",
                "detail": "auto",
                "image_url": f"data:image/jpeg;base64,{img}",
            }
        )

    body = {
        "model": f"gpt://{YANDEX_FOLDER_ID}/gemma-3-27b-it",
        "input": [{
            "role": "user",
            "type": "message",
            "content": input_content,
        }],
    }

    with httpx.Client(timeout=120) as http:
        resp = http.post(
            "https://ai.api.cloud.yandex.net/v1/responses",
            headers={
                "Authorization": f"Api-Key {YANDEX_API_KEY}",
                "Content-Type": "application/json",
            },
            json=body,
        )
        resp.raise_for_status()
        data = resp.json()

    usage = data.get("usage", {})
    text = data["output"][0]["content"][0]["text"]
    # Скрываем base64 в запросе для отображения
    request_for_display = {**body}
    display_input = []
    for msg in body["input"]:
        display_msg = {**msg}
        display_content = []
        for item in msg.get("content", []):
            if item.get("type") == "input_image" and item.get("image_url", "").startswith("data:"):
                display_content.append({**item, "image_url": item["image_url"][:64] + "…"})
            else:
                display_content.append(item)
        display_msg["content"] = display_content
        display_input.append(display_msg)
    request_for_display["input"] = display_input

    return {
        "text": text,
        "raw_json": data,
        "request_json": request_for_display,
        "total_tokens": usage.get("total_tokens"),
    }


def query_yandexart(prompt: str, width_ratio: int = 1, height_ratio: int = 1, seed: str | None = None) -> dict:
    body: dict = {
        "modelUri": f"art://{YANDEX_FOLDER_ID}/yandex-art/latest",
        "generationOptions": {
            "aspectRatio": {
                "widthRatio": str(width_ratio),
                "heightRatio": str(height_ratio),
            },
        },
        "messages": [{"text": prompt}],
    }
    if seed is not None:
        body["generationOptions"]["seed"] = seed

    # Submit async generation
    with httpx.Client(timeout=30) as http:
        resp = http.post(
            "https://llm.api.cloud.yandex.net/foundationModels/v1/imageGenerationAsync",
            headers=ART_HEADERS,
            json=body,
        )
        resp.raise_for_status()
        operation = resp.json()
        operation_id = operation["id"]

    # Poll for result
    with httpx.Client(timeout=30) as http:
        for _ in range(120):  # up to ~2 minutes
            time.sleep(1)
            resp = http.get(
                f"https://operation.api.cloud.yandex.net/operations/{operation_id}",
                headers=ART_HEADERS,
            )
            resp.raise_for_status()
            result = resp.json()
            if result.get("done"):
                if "error" in result:
                    raise RuntimeError(result["error"].get("message", "Ошибка генерации"))
                image_base64 = result["response"]["image"]
                return {"image_base64": image_base64, "raw_json": result, "request_json": body}

    raise TimeoutError("Генерация изображения заняла слишком много времени")
