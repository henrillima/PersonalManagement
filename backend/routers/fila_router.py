from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from auth import verify_token
from database import get_db

router = APIRouter(tags=["fila"])


class FilaItemCreate(BaseModel):
    tarefa_id: str
    titulo: str
    frente_cor: Optional[str] = None
    frente_nome: Optional[str] = None
    tempo_min: int = 25


class FilaItemUpdate(BaseModel):
    tempo_min: Optional[int] = None
    ordem: Optional[int] = None


class ReorderBody(BaseModel):
    ids: list[str]


@router.get("/fila")
def get_fila(user: str = Depends(verify_token)):
    db = get_db()
    return db.table("fila_execucao").select("*").eq("user_id", user).order("ordem").execute().data


@router.post("/fila", status_code=201)
def add_to_fila(body: FilaItemCreate, user: str = Depends(verify_token)):
    db = get_db()
    existing = (
        db.table("fila_execucao").select("ordem")
        .eq("user_id", user).order("ordem", desc=True).limit(1).execute().data
    )
    ordem = (existing[0]["ordem"] + 1) if existing else 0
    try:
        res = db.table("fila_execucao").insert({
            "user_id": user,
            "tarefa_id": body.tarefa_id,
            "titulo": body.titulo,
            "frente_cor": body.frente_cor,
            "frente_nome": body.frente_nome,
            "tempo_min": body.tempo_min,
            "ordem": ordem,
        }).execute()
        return res.data[0]
    except Exception:
        raise HTTPException(409, "Tarefa já está na fila")


# Static route BEFORE parameterized /{item_id}
@router.post("/fila/reorder")
def reorder_fila(body: ReorderBody, user: str = Depends(verify_token)):
    db = get_db()
    for i, item_id in enumerate(body.ids):
        db.table("fila_execucao").update({"ordem": i}).eq("id", item_id).eq("user_id", user).execute()
    return {"ok": True}


@router.patch("/fila/{item_id}")
def update_fila_item(item_id: str, body: FilaItemUpdate, user: str = Depends(verify_token)):
    db = get_db()
    data = {k: v for k, v in body.model_dump().items() if v is not None}
    if not data:
        raise HTTPException(400, "Nenhum campo")
    res = db.table("fila_execucao").update(data).eq("id", item_id).eq("user_id", user).execute()
    if not res.data:
        raise HTTPException(404)
    return res.data[0]


@router.delete("/fila/{item_id}", status_code=204)
def remove_from_fila(item_id: str, user: str = Depends(verify_token)):
    db = get_db()
    db.table("fila_execucao").delete().eq("id", item_id).eq("user_id", user).execute()
