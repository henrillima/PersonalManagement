from typing import Optional
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from auth import verify_token
from database import get_db

router = APIRouter(tags=["estudos"])

# ── Pydantic models ────────────────────────────────────────────────────────────

class CatEstudoCreate(BaseModel):
    nome: str
    emoji: str = "📚"

class CatEstudoUpdate(BaseModel):
    nome: Optional[str] = None
    emoji: Optional[str] = None
    ordem: Optional[int] = None

class FrenteEstudoCreate(BaseModel):
    categoria_id: str
    nome: str

class FrenteEstudoUpdate(BaseModel):
    nome: Optional[str] = None
    categoria_id: Optional[str] = None
    ordem: Optional[int] = None

class ItemEstudoCreate(BaseModel):
    frente_id: str
    titulo: str
    tipo: str = "Livro"
    obrigatorio: bool = True
    url: Optional[str] = None
    notas: Optional[str] = None

class ItemEstudoUpdate(BaseModel):
    titulo: Optional[str] = None
    tipo: Optional[str] = None
    obrigatorio: Optional[bool] = None
    progresso: Optional[int] = None
    concluido: Optional[bool] = None
    url: Optional[str] = None
    notas: Optional[str] = None
    ordem: Optional[int] = None
    frente_id: Optional[str] = None

class ReorderBody(BaseModel):
    ids: list[str]

# ── Categorias ─────────────────────────────────────────────────────────────────

@router.get("/estudos/categorias")
def list_categorias_estudo(_: str = Depends(verify_token)):
    return get_db().table("categorias_estudo").select("*").order("ordem").execute().data

@router.post("/estudos/categorias", status_code=201)
def create_categoria_estudo(body: CatEstudoCreate, _: str = Depends(verify_token)):
    db = get_db()
    count = len(db.table("categorias_estudo").select("id").execute().data)
    row = db.table("categorias_estudo").insert({**body.model_dump(), "ordem": count}).execute().data
    return row[0]

@router.patch("/estudos/categorias/{cat_id}")
def update_categoria_estudo(cat_id: str, body: CatEstudoUpdate, _: str = Depends(verify_token)):
    payload = body.model_dump(exclude_none=True)
    row = get_db().table("categorias_estudo").update(payload).eq("id", cat_id).execute().data
    return row[0] if row else {}

@router.delete("/estudos/categorias/{cat_id}", status_code=204)
def delete_categoria_estudo(cat_id: str, _: str = Depends(verify_token)):
    get_db().table("categorias_estudo").delete().eq("id", cat_id).execute()

# ── Frentes ────────────────────────────────────────────────────────────────────

@router.get("/estudos/frentes")
def list_frentes_estudo(_: str = Depends(verify_token)):
    return get_db().table("frentes_estudo").select("*").order("ordem").execute().data

@router.post("/estudos/frentes", status_code=201)
def create_frente_estudo(body: FrenteEstudoCreate, _: str = Depends(verify_token)):
    db = get_db()
    count = len(db.table("frentes_estudo").select("id").eq("categoria_id", body.categoria_id).execute().data)
    row = db.table("frentes_estudo").insert({**body.model_dump(), "ordem": count}).execute().data
    return row[0]

@router.patch("/estudos/frentes/{frente_id}")
def update_frente_estudo(frente_id: str, body: FrenteEstudoUpdate, _: str = Depends(verify_token)):
    payload = body.model_dump(exclude_none=True)
    row = get_db().table("frentes_estudo").update(payload).eq("id", frente_id).execute().data
    return row[0] if row else {}

@router.delete("/estudos/frentes/{frente_id}", status_code=204)
def delete_frente_estudo(frente_id: str, _: str = Depends(verify_token)):
    get_db().table("frentes_estudo").delete().eq("id", frente_id).execute()

# ── Itens ──────────────────────────────────────────────────────────────────────

@router.get("/estudos/itens")
def list_itens_estudo(_: str = Depends(verify_token)):
    return get_db().table("itens_estudo").select("*").order("ordem").execute().data

@router.post("/estudos/itens", status_code=201)
def create_item_estudo(body: ItemEstudoCreate, _: str = Depends(verify_token)):
    db = get_db()
    count = len(db.table("itens_estudo").select("id").eq("frente_id", body.frente_id).execute().data)
    row = db.table("itens_estudo").insert({**body.model_dump(exclude_none=True), "ordem": count}).execute().data
    return row[0]

# NOTE: static path /reorder must be defined before the /{item_id} routes
@router.post("/estudos/itens/reorder")
def reorder_itens_estudo(body: ReorderBody, _: str = Depends(verify_token)):
    db = get_db()
    for i, item_id in enumerate(body.ids):
        db.table("itens_estudo").update({"ordem": i}).eq("id", item_id).execute()
    return {"ok": True}

@router.patch("/estudos/itens/{item_id}")
def update_item_estudo(item_id: str, body: ItemEstudoUpdate, _: str = Depends(verify_token)):
    payload = body.model_dump(exclude_none=True)
    row = get_db().table("itens_estudo").update(payload).eq("id", item_id).execute().data
    return row[0] if row else {}

@router.delete("/estudos/itens/{item_id}", status_code=204)
def delete_item_estudo(item_id: str, _: str = Depends(verify_token)):
    get_db().table("itens_estudo").delete().eq("id", item_id).execute()
