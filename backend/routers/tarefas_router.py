from datetime import datetime, timezone
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
    categoria: Optional[str] = None

class FrenteUpdate(BaseModel):
    nome: Optional[str] = None
    cor: Optional[str] = None
    categoria: Optional[str] = None


@router.get("/frentes")
def list_frentes(_: str = Depends(verify_token)):
    return get_db().table("frentes").select("*").order("nome").execute().data


@router.post("/frentes", status_code=201)
def create_frente(body: FrenteCreate, _: str = Depends(verify_token)):
    row = get_db().table("frentes").insert({"nome": body.nome, "cor": body.cor}).execute().data
    return row[0] if row else {}


@router.patch("/frentes/{frente_id}")
def update_frente(frente_id: str, body: FrenteUpdate, _: str = Depends(verify_token)):
    payload = body.model_dump(exclude_none=True)
    if not payload:
        raise HTTPException(400, "Nenhum campo para atualizar")
    row = get_db().table("frentes").update(payload).eq("id", frente_id).execute().data
    return row[0] if row else {}


@router.delete("/frentes/{frente_id}", status_code=204)
def delete_frente(frente_id: str, _: str = Depends(verify_token)):
    get_db().table("frentes").delete().eq("id", frente_id).execute()


# ── Tarefas ───────────────────────────────────────────────────────────────────

class TarefaCreate(BaseModel):
    titulo: str
    descricao: Optional[str] = None
    frente_id: Optional[str] = None
    categoria: str = "Pessoal"
    prioridade: str = "media"
    status: str = "todo"
    ordem: Optional[int] = None
    data_limite: Optional[str] = None
    observacao: Optional[str] = None


class TarefaUpdate(BaseModel):
    titulo: Optional[str] = None
    descricao: Optional[str] = None
    frente_id: Optional[str] = None
    categoria: Optional[str] = None
    prioridade: Optional[str] = None
    status: Optional[str] = None
    ordem: Optional[int] = None
    data_limite: Optional[str] = None
    observacao: Optional[str] = None
    concluida: Optional[bool] = None
    arquivado: Optional[bool] = None
    tipo_arquivo: Optional[str] = None


class ReorderBody(BaseModel):
    ids: list[str]


def _flatten_frente(rows: list) -> list:
    result = []
    for r in rows:
        frente = r.pop("frentes", None) or {}
        result.append({**r, "frente_nome": frente.get("nome"), "frente_cor": frente.get("cor")})
    return result


@router.get("/tarefas")
def list_tarefas(
    arquivado: bool = False,
    categoria: Optional[str] = None,
    status: Optional[str] = None,
    frente_id: Optional[str] = None,
    _: str = Depends(verify_token),
):
    db = get_db()
    q = (
        db.table("tarefas")
        .select("*, frentes(id, nome, cor)")
        .eq("arquivado", arquivado)
        .order("categoria")
        .order("status")
        .order("ordem")
        .order("criado_em")
    )
    if categoria:
        q = q.eq("categoria", categoria)
    if status:
        q = q.eq("status", status)
    if frente_id:
        q = q.eq("frente_id", frente_id)
    return _flatten_frente(q.execute().data)


# Rota estática ANTES das rotas com parâmetros
@router.post("/tarefas/reorder")
def reorder_tarefas(body: ReorderBody, _: str = Depends(verify_token)):
    """Atualiza o campo `ordem` de cada tarefa conforme a posição no array."""
    db = get_db()
    for i, task_id in enumerate(body.ids):
        db.table("tarefas").update({"ordem": i}).eq("id", task_id).execute()
    return {"ok": True}


@router.post("/tarefas", status_code=201)
def create_tarefa(body: TarefaCreate, _: str = Depends(verify_token)):
    db = get_db()
    payload = body.model_dump(exclude_none=True)
    # Se ordem não foi fornecida, coloca no final da coluna/categoria
    if "ordem" not in payload:
        count = len(
            db.table("tarefas")
            .select("id")
            .eq("status", payload.get("status", "todo"))
            .eq("categoria", payload.get("categoria", "Pessoal"))
            .eq("arquivado", False)
            .execute().data
        )
        payload["ordem"] = count
    row = db.table("tarefas").insert(payload).execute().data
    return row[0] if row else {}


@router.patch("/tarefas/{tarefa_id}")
def update_tarefa(tarefa_id: str, body: TarefaUpdate, _: str = Depends(verify_token)):
    db = get_db()
    payload = body.model_dump(exclude_none=True)
    if not payload:
        raise HTTPException(400, "Nenhum campo para atualizar")
    if payload.get("status") == "done":
        payload.setdefault("concluida", True)
    elif "status" in payload and payload["status"] != "done":
        payload.setdefault("concluida", False)
    payload["atualizado_em"] = datetime.now(timezone.utc).isoformat()
    row = db.table("tarefas").update(payload).eq("id", tarefa_id).execute().data
    return row[0] if row else {}


@router.post("/tarefas/{tarefa_id}/restaurar")
def restaurar_tarefa(tarefa_id: str, _: str = Depends(verify_token)):
    """Remove do arquivo — volta para a matriz ativa."""
    db = get_db()
    row = db.table("tarefas").update({
        "arquivado": False,
        "tipo_arquivo": None,
        "atualizado_em": datetime.now(timezone.utc).isoformat(),
    }).eq("id", tarefa_id).execute().data
    return row[0] if row else {}


@router.delete("/tarefas/{tarefa_id}", status_code=204)
def delete_tarefa(tarefa_id: str, _: str = Depends(verify_token)):
    get_db().table("tarefas").delete().eq("id", tarefa_id).execute()
