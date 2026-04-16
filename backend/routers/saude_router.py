import json
import os
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from openai import OpenAI
from pydantic import BaseModel

from auth import verify_token
from database import get_db

router = APIRouter(tags=["saude"])


def _openai():
    key = os.environ.get("OPENAI_API_KEY", "")
    if not key:
        raise HTTPException(status_code=503, detail="OPENAI_API_KEY não configurada no servidor")
    return OpenAI(api_key=key)


# ── Perfil ────────────────────────────────────────────────────────────────────

class PerfilUpdate(BaseModel):
    idade: Optional[int] = None
    altura: Optional[float] = None
    sexo: Optional[str] = None        # M | F
    fator_idx: Optional[int] = None   # 1-5

FATORES = [1.2, 1.375, 1.55, 1.725, 1.9]

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
    data: str
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

class DietaAnalise(BaseModel):
    data: str
    refeicao: str
    descricao: str

@router.get("/saude/dieta")
def list_dieta(data: Optional[str] = None, _: str = Depends(verify_token)):
    q = get_db().table("saude_dieta").select("*").order("data", desc=True).order("criado_em")
    if data:
        q = q.eq("data", data)
    return q.execute().data

# Rota estática ANTES da rota com parâmetro {dieta_id}
@router.post("/saude/dieta/analisar", status_code=201)
def analisar_dieta(body: DietaAnalise, _: str = Depends(verify_token)):
    """Analisa macronutrientes com GPT-4o-mini e salva no banco."""
    try:
        resp = _openai().chat.completions.create(
            model="gpt-4o-mini",
            response_format={"type": "json_object"},
            messages=[
                {
                    "role": "system",
                    "content": (
                        "Você é um nutricionista calculista. "
                        "Retorne APENAS um objeto JSON com as chaves numéricas: "
                        "calorias (kcal, inteiro), proteina (g, inteiro), "
                        "carboidrato (g, inteiro), gordura (g, inteiro)."
                    ),
                },
                {
                    "role": "user",
                    "content": f"Estime os macronutrientes desta refeição: \"{body.descricao}\".",
                },
            ],
        )
        macros = json.loads(resp.choices[0].message.content)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Erro na OpenAI: {e}")

    payload = {
        "data": body.data,
        "refeicao": body.refeicao,
        "descricao": body.descricao,
        "calorias": int(macros.get("calorias") or 0),
        "proteina": int(macros.get("proteina") or 0),
        "carboidrato": int(macros.get("carboidrato") or 0),
        "gordura": int(macros.get("gordura") or 0),
    }
    row = get_db().table("saude_dieta").insert(payload).execute().data
    return row[0] if row else payload

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

class TreinoAnalise(BaseModel):
    data: str
    descricao: str
    peso_atual: Optional[float] = None

@router.get("/saude/treino")
def list_treino(data: Optional[str] = None, _: str = Depends(verify_token)):
    q = get_db().table("saude_treino").select("*").order("data", desc=True)
    if data:
        q = q.eq("data", data)
    return q.execute().data

# Rota estática ANTES da rota com parâmetro {treino_id}
@router.post("/saude/treino/analisar", status_code=201)
def analisar_treino(body: TreinoAnalise, _: str = Depends(verify_token)):
    """Estima gasto calórico do treino com GPT-4o-mini e salva no banco."""
    peso = body.peso_atual or 70
    try:
        resp = _openai().chat.completions.create(
            model="gpt-4o-mini",
            response_format={"type": "json_object"},
            messages=[
                {
                    "role": "system",
                    "content": (
                        "Você é um fisiologista esportivo. "
                        "Retorne APENAS um objeto JSON com a chave numérica inteira: gasto_calorico (kcal)."
                    ),
                },
                {
                    "role": "user",
                    "content": (
                        f"Estime o gasto calórico ativo deste treino "
                        f"realizado por uma pessoa de {peso}kg: \"{body.descricao}\"."
                    ),
                },
            ],
        )
        dados = json.loads(resp.choices[0].message.content)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Erro na OpenAI: {e}")

    payload = {
        "data": body.data,
        "descricao": body.descricao,
        "gasto_calorico": int(dados.get("gasto_calorico") or 0),
    }
    row = get_db().table("saude_treino").insert(payload).execute().data
    return row[0] if row else payload

@router.post("/saude/treino", status_code=201)
def create_treino(body: TreinoCreate, _: str = Depends(verify_token)):
    row = get_db().table("saude_treino").insert(body.model_dump(exclude_none=True)).execute().data
    return row[0] if row else {}

@router.delete("/saude/treino/{treino_id}", status_code=204)
def delete_treino(treino_id: str, _: str = Depends(verify_token)):
    get_db().table("saude_treino").delete().eq("id", treino_id).execute()
