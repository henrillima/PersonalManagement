from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from auth import verify_token
from database import get_db

router = APIRouter(tags=["metas"])


class MetaCreate(BaseModel):
    titulo: str
    descricao: Optional[str] = None
    area: str = "pessoal"
    prazo: Optional[str] = None
    emoji: str = "🎯"
    progresso: int = 0


class MetaUpdate(BaseModel):
    titulo: Optional[str] = None
    descricao: Optional[str] = None
    area: Optional[str] = None
    prazo: Optional[str] = None
    emoji: Optional[str] = None
    progresso: Optional[int] = None
    status: Optional[str] = None


@router.get("/metas")
def list_metas(user=Depends(verify_token)):
    db = get_db()
    res = db.table("metas_vida").select("*").eq("user_id", user["sub"]).order("criado_em").execute()
    return res.data


@router.post("/metas", status_code=201)
def create_meta(body: MetaCreate, user=Depends(verify_token)):
    db = get_db()
    row = body.model_dump()
    row["user_id"] = user["sub"]
    res = db.table("metas_vida").insert(row).execute()
    return res.data[0]


@router.patch("/metas/{meta_id}")
def update_meta(meta_id: str, body: MetaUpdate, user=Depends(verify_token)):
    db = get_db()
    data = {k: v for k, v in body.model_dump().items() if v is not None}
    res = (
        db.table("metas_vida")
        .update(data)
        .eq("id", meta_id)
        .eq("user_id", user["sub"])
        .execute()
    )
    if not res.data:
        raise HTTPException(404)
    return res.data[0]


@router.delete("/metas/{meta_id}", status_code=204)
def delete_meta(meta_id: str, user=Depends(verify_token)):
    db = get_db()
    db.table("metas_vida").delete().eq("id", meta_id).eq("user_id", user["sub"]).execute()
