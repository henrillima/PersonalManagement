import os
import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from auth import verify_token

def _gas_url() -> str:
    url = os.environ.get("GOOGLE_CALENDAR_URL", "")
    if not url:
        raise HTTPException(503, "Integração com Google Calendar não configurada")
    return url

router = APIRouter(tags=["agenda"])


class EventoCreate(BaseModel):
    title: str
    start: str
    end: str
    description: Optional[str] = None
    guests: Optional[str] = None


@router.get("/agenda")
def get_agenda(_: str = Depends(verify_token)):
    try:
        with httpx.Client(follow_redirects=True, timeout=15) as client:
            resp = client.get(_gas_url())
            eventos = resp.json()
            # Exclui tasks do Google (start sem componente de hora, ex: "2024-04-17")
            return [ev for ev in eventos if "T" in ev.get("start", "")]
    except Exception as e:
        raise HTTPException(502, f"Erro ao buscar agenda: {e}")


@router.post("/agenda", status_code=201)
def create_evento(body: EventoCreate, _: str = Depends(verify_token)):
    try:
        with httpx.Client(follow_redirects=True, timeout=15) as client:
            resp = client.post(_gas_url(), json=body.model_dump(exclude_none=True))
            return resp.json()
    except Exception as e:
        raise HTTPException(502, f"Erro ao criar evento: {e}")
