from typing import Optional
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from auth import verify_token
from database import get_db

router = APIRouter(tags=["corretoras"])


class CorretoraCreate(BaseModel):
    nome: str
    cor: Optional[str] = "#94a3b8"


class CorretoraUpdate(BaseModel):
    nome: Optional[str] = None
    cor: Optional[str] = None


@router.get("/corretoras")
def list_corretoras(_: str = Depends(verify_token)):
    return get_db().table("corretoras").select("*").order("nome").execute().data


@router.post("/corretoras", status_code=201)
def create_corretora(body: CorretoraCreate, _: str = Depends(verify_token)):
    row = get_db().table("corretoras").insert(body.model_dump(exclude_none=True)).execute().data
    return row[0] if row else {}


@router.patch("/corretoras/{corretora_id}")
def update_corretora(corretora_id: str, body: CorretoraUpdate, _: str = Depends(verify_token)):
    payload = body.model_dump(exclude_none=True)
    if not payload:
        return {}
    row = get_db().table("corretoras").update(payload).eq("id", corretora_id).execute().data
    return row[0] if row else {}


@router.delete("/corretoras/{corretora_id}", status_code=204)
def delete_corretora(corretora_id: str, _: str = Depends(verify_token)):
    get_db().table("corretoras").delete().eq("id", corretora_id).execute()
