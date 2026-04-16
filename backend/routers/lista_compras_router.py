from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from auth import verify_token
from database import get_db

router = APIRouter(tags=["lista_compras"])


class ItemCreate(BaseModel):
    nome: str
    quantidade: float = 1.0
    unidade: str = "un"
    valor_esperado: Optional[float] = None
    categoria: Optional[str] = None


class ItemUpdate(BaseModel):
    nome: Optional[str] = None
    quantidade: Optional[float] = None
    unidade: Optional[str] = None
    valor_esperado: Optional[float] = None
    categoria: Optional[str] = None
    comprado: Optional[bool] = None


@router.get("/lista-compras")
def list_items(_: str = Depends(verify_token)):
    return (
        get_db()
        .table("lista_compras")
        .select("*")
        .order("comprado")
        .order("categoria", nulls_first=True)
        .order("criado_em")
        .execute()
        .data
    )


@router.post("/lista-compras", status_code=201)
def create_item(body: ItemCreate, _: str = Depends(verify_token)):
    row = get_db().table("lista_compras").insert(body.model_dump(exclude_none=True)).execute().data
    return row[0] if row else {}


@router.patch("/lista-compras/{item_id}")
def update_item(item_id: str, body: ItemUpdate, _: str = Depends(verify_token)):
    payload = body.model_dump(exclude_none=True)
    if not payload:
        raise HTTPException(400, "Nenhum campo para atualizar")
    row = get_db().table("lista_compras").update(payload).eq("id", item_id).execute().data
    return row[0] if row else {}


@router.delete("/lista-compras/{item_id}", status_code=204)
def delete_item(item_id: str, _: str = Depends(verify_token)):
    get_db().table("lista_compras").delete().eq("id", item_id).execute()
