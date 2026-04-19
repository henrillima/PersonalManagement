from typing import Optional
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from auth import verify_token
from database import get_db

router = APIRouter(tags=["pessoas"])


class PessoaCreate(BaseModel):
    nome: str
    telefone: Optional[str] = None


class PessoaUpdate(BaseModel):
    nome: Optional[str] = None
    telefone: Optional[str] = None


@router.get("/pessoas")
def list_pessoas(_: str = Depends(verify_token)):
    return get_db().table("pessoas").select("*").order("nome").execute().data


@router.post("/pessoas", status_code=201)
def create_pessoa(body: PessoaCreate, _: str = Depends(verify_token)):
    row = get_db().table("pessoas").insert(body.model_dump(exclude_none=True)).execute().data
    return row[0] if row else {}


@router.patch("/pessoas/{pessoa_id}")
def update_pessoa(pessoa_id: str, body: PessoaUpdate, _: str = Depends(verify_token)):
    payload = body.model_dump(exclude_none=True)
    if not payload:
        return {}
    row = get_db().table("pessoas").update(payload).eq("id", pessoa_id).execute().data
    return row[0] if row else {}


@router.delete("/pessoas/{pessoa_id}", status_code=204)
def delete_pessoa(pessoa_id: str, _: str = Depends(verify_token)):
    get_db().table("pessoas").delete().eq("id", pessoa_id).execute()
