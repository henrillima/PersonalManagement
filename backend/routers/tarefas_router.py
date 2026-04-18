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
    row = get_db().table("frentes").insert(body.model_dump(exclude_none=True)).execute().data
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


# ── Tarefas Recorrentes ───────────────────────────────────────────────────────

class TarefaRecorrenteCreate(BaseModel):
    titulo: str
    descricao: Optional[str] = None
    frente_id: Optional[str] = None
    categoria: str = "Geral"
    prioridade: str = "media"
    frequencia: str  # 'diaria' | 'semanal' | 'mensal' | 'anual'
    dias_semana: Optional[list[int]] = None
    dia_mes: Optional[int] = None
    mes: Optional[int] = None

class TarefaRecorrenteUpdate(BaseModel):
    titulo: Optional[str] = None
    descricao: Optional[str] = None
    frente_id: Optional[str] = None
    categoria: Optional[str] = None
    prioridade: Optional[str] = None
    frequencia: Optional[str] = None
    dias_semana: Optional[list[int]] = None
    dia_mes: Optional[int] = None
    mes: Optional[int] = None
    ativo: Optional[bool] = None

class OcorrenciaUpdate(BaseModel):
    concluida: bool

# Static route MUST be defined before the parameterized /{rec_id} routes
@router.get("/tarefas-recorrentes/ocorrencias")
def get_ocorrencias(mes: str, _: str = Depends(verify_token)):
    from datetime import date
    import calendar

    db = get_db()
    year, month = int(mes[:4]), int(mes[5:7])
    _, days_in_month = calendar.monthrange(year, month)

    templates = db.table("tarefas_recorrentes").select("*, frentes(nome, cor)").eq("ativo", True).execute().data
    templates = _flatten_frente(templates)

    to_insert = []
    for t in templates:
        freq = t["frequencia"]
        dates: list[date] = []

        if freq == "diaria":
            for day in range(1, days_in_month + 1):
                dates.append(date(year, month, day))
        elif freq == "semanal":
            dias = t.get("dias_semana") or []
            for day in range(1, days_in_month + 1):
                d = date(year, month, day)
                if d.weekday() in dias:
                    dates.append(d)
        elif freq == "mensal":
            dia = t.get("dia_mes")
            if dia and 1 <= dia <= days_in_month:
                dates.append(date(year, month, dia))
        elif freq == "anual":
            dia = t.get("dia_mes")
            mes_anual = t.get("mes")
            if dia and mes_anual == month:
                try:
                    dates.append(date(year, month, dia))
                except ValueError:
                    pass

        for d in dates:
            to_insert.append({"recorrente_id": t["id"], "data_alvo": d.isoformat()})

    if to_insert:
        db.table("tarefas_recorrentes_ocorrencias").upsert(
            to_insert,
            on_conflict="recorrente_id,data_alvo",
            ignore_duplicates=True,
        ).execute()

    mes_start = f"{mes}-01"
    mes_end = f"{mes}-{days_in_month:02d}"
    ocorrencias = (
        db.table("tarefas_recorrentes_ocorrencias")
        .select("*")
        .gte("data_alvo", mes_start)
        .lte("data_alvo", mes_end)
        .order("data_alvo")
        .execute()
        .data
    )

    tmpl_map = {t["id"]: t for t in templates}
    result = []
    for o in ocorrencias:
        tmpl = tmpl_map.get(o["recorrente_id"], {})
        result.append({
            **o,
            "titulo": tmpl.get("titulo", ""),
            "descricao": tmpl.get("descricao"),
            "categoria": tmpl.get("categoria", "Geral"),
            "prioridade": tmpl.get("prioridade", "media"),
            "frente_nome": tmpl.get("frente_nome"),
            "frente_cor": tmpl.get("frente_cor"),
            "frequencia": tmpl.get("frequencia"),
        })
    return result

@router.get("/tarefas-recorrentes")
def list_tarefas_recorrentes(_: str = Depends(verify_token)):
    rows = get_db().table("tarefas_recorrentes").select("*, frentes(nome, cor)").order("titulo").execute().data
    return _flatten_frente(rows)

@router.post("/tarefas-recorrentes", status_code=201)
def create_tarefa_recorrente(body: TarefaRecorrenteCreate, _: str = Depends(verify_token)):
    row = get_db().table("tarefas_recorrentes").insert(body.model_dump(exclude_none=True)).execute().data
    return row[0] if row else {}

@router.patch("/tarefas-recorrentes/ocorrencias/{ocorrencia_id}")
def toggle_ocorrencia(ocorrencia_id: str, body: OcorrenciaUpdate, _: str = Depends(verify_token)):
    row = (
        get_db()
        .table("tarefas_recorrentes_ocorrencias")
        .update({"concluida": body.concluida})
        .eq("id", ocorrencia_id)
        .execute()
        .data
    )
    return row[0] if row else {}

@router.patch("/tarefas-recorrentes/{rec_id}")
def update_tarefa_recorrente(rec_id: str, body: TarefaRecorrenteUpdate, _: str = Depends(verify_token)):
    payload = body.model_dump(exclude_none=True)
    if not payload:
        raise HTTPException(400, "Nenhum campo")
    row = get_db().table("tarefas_recorrentes").update(payload).eq("id", rec_id).execute().data
    return row[0] if row else {}

@router.delete("/tarefas-recorrentes/{rec_id}", status_code=204)
def delete_tarefa_recorrente(rec_id: str, _: str = Depends(verify_token)):
    get_db().table("tarefas_recorrentes").delete().eq("id", rec_id).execute()
