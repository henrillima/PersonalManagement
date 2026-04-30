from typing import Optional
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from auth import verify_token
from database import get_db

router = APIRouter(tags=["subtarefas"])


class SubtarefaCreate(BaseModel):
    tarefa_id: str
    titulo: str
    descricao: Optional[str] = None
    observacao: Optional[str] = None


class SubtarefaUpdate(BaseModel):
    titulo: Optional[str] = None
    descricao: Optional[str] = None
    observacao: Optional[str] = None
    concluida: Optional[bool] = None


@router.get("/subtarefas")
def list_subtarefas(user: str = Depends(verify_token)):
    return get_db().table("subtarefas").select("*").eq("user_id", user).order("ordem").execute().data


@router.post("/subtarefas", status_code=201)
def create_subtarefa(body: SubtarefaCreate, user: str = Depends(verify_token)):
    db = get_db()
    count = len(db.table("subtarefas").select("id").eq("tarefa_id", body.tarefa_id).execute().data)
    res = db.table("subtarefas").insert({
        "user_id": user,
        "tarefa_id": body.tarefa_id,
        "titulo": body.titulo,
        "ordem": count,
    }).execute()
    return res.data[0]


@router.patch("/subtarefas/{sub_id}")
def update_subtarefa(sub_id: str, body: SubtarefaUpdate, user: str = Depends(verify_token)):
    payload = body.model_dump(exclude_none=True)
    if not payload:
        return {}
    res = get_db().table("subtarefas").update(payload).eq("id", sub_id).eq("user_id", user).execute()
    return res.data[0] if res.data else {}


@router.delete("/subtarefas/{sub_id}", status_code=204)
def delete_subtarefa(sub_id: str, user: str = Depends(verify_token)):
    get_db().table("subtarefas").delete().eq("id", sub_id).eq("user_id", user).execute()
