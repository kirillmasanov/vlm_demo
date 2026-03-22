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
    content: list[dict] = [{"type": "text", "text": prompt}]
    for img in images:
        content.append(
            {
                "type": "image_url",
                "image_url": {"url": f"data:image/jpeg;base64,{img}"},
            }
        )

    response = client.chat.completions.create(
        model=f"gpt://{YANDEX_FOLDER_ID}/gemma-3-27b-it",
        messages=[
            {
                "role": "user",
                "content": content,
            }
        ],
        max_tokens=None,
        stream=False,
    )
    return {
        "text": response.choices[0].message.content,
        "raw_json": response.model_dump(),
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
                return {"image_base64": image_base64, "raw_json": result}

    raise TimeoutError("Генерация изображения заняла слишком много времени")
