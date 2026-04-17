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


def _add_tz(dt_str: str) -> str:
    """Garante sufixo UTC se não houver timezone."""
    if dt_str and "Z" not in dt_str and "+" not in dt_str and len(dt_str) >= 16:
        return dt_str + "Z"
    return dt_str


@router.get("/agenda")
def get_agenda(_: str = Depends(verify_token)):
    try:
        with httpx.Client(follow_redirects=True, timeout=15) as client:
            resp = client.get(_gas_url())
            eventos = resp.json()
            for ev in eventos:
                ev["start"] = _add_tz(ev.get("start", ""))
                ev["end"] = _add_tz(ev.get("end", ""))
            return eventos
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
