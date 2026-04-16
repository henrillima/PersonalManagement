from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from auth import verify_token
from database import get_db

router = APIRouter(tags=["tarefas"])

# ── Frentes ───────────────────────────────────────────────────────────────────

class FrenteCreate(BaseModel):
    nome: str
    cor: str = "#94a3b8"

class FrenteUpdate(BaseModel):
    nome: Optional[str] = None
    cor: Optional[str] = None


@router.get("/frentes")
def list_frentes(_: str = Depends(verify_token)):
    db = get_db()
    rows = db.table("frentes").select("*").order("nome").execute().data
    return rows


@router.post("/frentes", status_code=201)
def create_frente(body: FrenteCreate, _: str = Depends(verify_token)):
    db = get_db()
    row = db.table("frentes").insert({"nome": body.nome, "cor": body.cor}).execute().data
    return row[0] if row else {}


@router.patch("/frentes/{frente_id}")
def update_frente(frente_id: str, body: FrenteUpdate, _: str = Depends(verify_token)):
    db = get_db()
    payload = body.model_dump(exclude_none=True)
    if not payload:
        raise HTTPException(400, "Nenhum campo para atualizar")
    row = db.table("frentes").update(payload).eq("id", frente_id).execute().data
    return row[0] if row else {}


@router.delete("/frentes/{frente_id}", status_code=204)
def delete_frente(frente_id: str, _: str = Depends(verify_token)):
    db = get_db()
    db.table("frentes").delete().eq("id", frente_id).execute()


# ── Tarefas ───────────────────────────────────────────────────────────────────

class TarefaCreate(BaseModel):
    titulo: str
    descricao: Optional[str] = None
    frente_id: Optional[str] = None
    prioridade: str = "media"
    status: str = "todo"
    data_limite: Optional[str] = None
    observacao: Optional[str] = None


class TarefaUpdate(BaseModel):
    titulo: Optional[str] = None
    descricao: Optional[str] = None
    frente_id: Optional[str] = None
    prioridade: Optional[str] = None
    status: Optional[str] = None
    data_limite: Optional[str] = None
    observacao: Optional[str] = None
    concluida: Optional[bool] = None


@router.get("/tarefas")
def list_tarefas(
    status: Optional[str] = None,
    frente_id: Optional[str] = None,
    _: str = Depends(verify_token),
):
    db = get_db()
    q = db.table("tarefas").select("*, frentes(id, nome, cor)").order("criado_em", desc=True)
    if status:
        q = q.eq("status", status)
    if frente_id:
        q = q.eq("frente_id", frente_id)
    rows = q.execute().data
    # Flatten join
    result = []
    for r in rows:
        frente = r.pop("frentes", None) or {}
        result.append({**r, "frente_nome": frente.get("nome"), "frente_cor": frente.get("cor")})
    return result


@router.post("/tarefas", status_code=201)
def create_tarefa(body: TarefaCreate, _: str = Depends(verify_token)):
    db = get_db()
    payload = body.model_dump(exclude_none=True)
    row = db.table("tarefas").insert(payload).execute().data
    return row[0] if row else {}


@router.patch("/tarefas/{tarefa_id}")
def update_tarefa(tarefa_id: str, body: TarefaUpdate, _: str = Depends(verify_token)):
    db = get_db()
    payload = body.model_dump(exclude_none=True)
    if not payload:
        raise HTTPException(400, "Nenhum campo para atualizar")
    # Auto-marcar concluída se status=done
    if payload.get("status") == "done":
        payload.setdefault("concluida", True)
    elif "status" in payload and payload["status"] != "done":
        payload.setdefault("concluida", False)
    from datetime import datetime, timezone
    payload["atualizado_em"] = datetime.now(timezone.utc).isoformat()
    row = db.table("tarefas").update(payload).eq("id", tarefa_id).execute().data
    return row[0] if row else {}


@router.delete("/tarefas/{tarefa_id}", status_code=204)
def delete_tarefa(tarefa_id: str, _: str = Depends(verify_token)):
    db = get_db()
    db.table("tarefas").delete().eq("id", tarefa_id).execute()
