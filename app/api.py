from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from .services import query_gemma, query_yandexart

router = APIRouter(prefix="/api")


class GemmaRequest(BaseModel):
    images: list[str]
    prompt: str
    temperature: float = 0.7
    max_output_tokens: int | None = None


class GemmaResponse(BaseModel):
    result: str
    raw_json: Any
    request_json: Any
    total_tokens: int | None = None


@router.post("/gemma", response_model=GemmaResponse)
async def gemma_endpoint(req: GemmaRequest):
    try:
        data = query_gemma(req.images, req.prompt, req.temperature, req.max_output_tokens)
        return GemmaResponse(result=data["text"], raw_json=data["raw_json"], request_json=data["request_json"], total_tokens=data["total_tokens"])
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class YandexArtRequest(BaseModel):
    prompt: str
    width_ratio: int = 1
    height_ratio: int = 1
    seed: str | None = None


class YandexArtResponse(BaseModel):
    image_base64: str
    raw_json: Any
    request_json: Any


@router.post("/yandexart", response_model=YandexArtResponse)
async def yandexart_endpoint(req: YandexArtRequest):
    try:
        data = query_yandexart(req.prompt, req.width_ratio, req.height_ratio, req.seed)
        return YandexArtResponse(image_base64=data["image_base64"], raw_json=data["raw_json"], request_json=data["request_json"])
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
