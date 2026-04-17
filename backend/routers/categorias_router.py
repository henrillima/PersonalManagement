from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from auth import verify_token
from database import get_db

router = APIRouter(tags=["categorias"])


class CategoriaCreate(BaseModel):
    nome: str
    emoji: str = "📁"
    cor: str = "#94a3b8"
    ordem: Optional[int] = None


class CategoriaUpdate(BaseModel):
    nome: Optional[str] = None
    emoji: Optional[str] = None
    cor: Optional[str] = None
    ordem: Optional[int] = None


@router.get("/categorias")
def list_categorias(_: str = Depends(verify_token)):
    return get_db().table("categorias").select("*").order("ordem").order("nome").execute().data


@router.post("/categorias", status_code=201)
def create_categoria(body: CategoriaCreate, _: str = Depends(verify_token)):
    db = get_db()
    payload = body.model_dump(exclude_none=True)
    if "ordem" not in payload:
        count = len(db.table("categorias").select("id").execute().data)
        payload["ordem"] = count
    row = db.table("categorias").insert(payload).execute().data
    return row[0] if row else {}


@router.patch("/categorias/{cat_id}")
def update_categoria(cat_id: str, body: CategoriaUpdate, _: str = Depends(verify_token)):
    payload = body.model_dump(exclude_none=True)
    if not payload:
        raise HTTPException(400, "Nenhum campo para atualizar")
    row = get_db().table("categorias").update(payload).eq("id", cat_id).execute().data
    return row[0] if row else {}


@router.delete("/categorias/{cat_id}", status_code=204)
def delete_categoria(cat_id: str, _: str = Depends(verify_token)):
    get_db().table("categorias").delete().eq("id", cat_id).execute()
