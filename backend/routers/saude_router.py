from typing import Optional
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from auth import verify_token
from database import get_db

router = APIRouter(tags=["saude"])

# ── Perfil ────────────────────────────────────────────────────────────────────

class PerfilUpdate(BaseModel):
    idade: Optional[int] = None
    altura: Optional[float] = None
    sexo: Optional[str] = None        # M | F
    fator_idx: Optional[int] = None   # 1-5

FATORES = [1.2, 1.375, 1.55, 1.725, 1.9]
FATOR_LABELS = ["Sedentário", "Levemente ativo", "Moderadamente ativo", "Muito ativo", "Extremamente ativo"]

def _tmb(perfil: dict) -> Optional[float]:
    idade = perfil.get("idade")
    altura = perfil.get("altura")
    sexo = perfil.get("sexo")
    if not all([idade, altura, sexo]):
        return None
    # Fórmula de Mifflin-St Jeor (sem peso — simplificada sem peso)
    # Na prática não dá pra calcular TMB sem peso, então retornamos None
    return None

@router.get("/saude/perfil")
def get_perfil(_: str = Depends(verify_token)):
    rows = get_db().table("saude_perfil").select("*").execute().data
    return rows[0] if rows else {}

@router.put("/saude/perfil")
def upsert_perfil(body: PerfilUpdate, _: str = Depends(verify_token)):
    db = get_db()
    existing = db.table("saude_perfil").select("id").execute().data
    payload = body.model_dump(exclude_none=True)
    from datetime import datetime, timezone
    payload["atualizado_em"] = datetime.now(timezone.utc).isoformat()
    if existing:
        row = db.table("saude_perfil").update(payload).eq("id", existing[0]["id"]).execute().data
    else:
        row = db.table("saude_perfil").insert(payload).execute().data
    return row[0] if row else {}

# ── Peso ──────────────────────────────────────────────────────────────────────

class PesoCreate(BaseModel):
    data: str   # YYYY-MM-DD
    peso: float

@router.get("/saude/peso")
def list_peso(_: str = Depends(verify_token)):
    return get_db().table("saude_peso").select("*").order("data", desc=True).execute().data

@router.post("/saude/peso", status_code=201)
def create_peso(body: PesoCreate, _: str = Depends(verify_token)):
    row = get_db().table("saude_peso").upsert({"data": body.data, "peso": body.peso}, on_conflict="data").execute().data
    return row[0] if row else {}

@router.delete("/saude/peso/{peso_id}", status_code=204)
def delete_peso(peso_id: str, _: str = Depends(verify_token)):
    get_db().table("saude_peso").delete().eq("id", peso_id).execute()

# ── Dieta ─────────────────────────────────────────────────────────────────────

class DietaCreate(BaseModel):
    data: str
    refeicao: str
    descricao: str
    calorias: Optional[int] = None
    proteina: Optional[float] = None
    carboidrato: Optional[float] = None
    gordura: Optional[float] = None

@router.get("/saude/dieta")
def list_dieta(data: Optional[str] = None, _: str = Depends(verify_token)):
    q = get_db().table("saude_dieta").select("*").order("data", desc=True).order("criado_em")
    if data:
        q = q.eq("data", data)
    return q.execute().data

@router.post("/saude/dieta", status_code=201)
def create_dieta(body: DietaCreate, _: str = Depends(verify_token)):
    row = get_db().table("saude_dieta").insert(body.model_dump(exclude_none=True)).execute().data
    return row[0] if row else {}

@router.delete("/saude/dieta/{dieta_id}", status_code=204)
def delete_dieta(dieta_id: str, _: str = Depends(verify_token)):
    get_db().table("saude_dieta").delete().eq("id", dieta_id).execute()

# ── Treino ────────────────────────────────────────────────────────────────────

class TreinoCreate(BaseModel):
    data: str
    descricao: str
    gasto_calorico: Optional[int] = None

@router.get("/saude/treino")
def list_treino(data: Optional[str] = None, _: str = Depends(verify_token)):
    q = get_db().table("saude_treino").select("*").order("data", desc=True)
    if data:
        q = q.eq("data", data)
    return q.execute().data

@router.post("/saude/treino", status_code=201)
def create_treino(body: TreinoCreate, _: str = Depends(verify_token)):
    row = get_db().table("saude_treino").insert(body.model_dump(exclude_none=True)).execute().data
    return row[0] if row else {}

@router.delete("/saude/treino/{treino_id}", status_code=204)
def delete_treino(treino_id: str, _: str = Depends(verify_token)):
    get_db().table("saude_treino").delete().eq("id", treino_id).execute()
