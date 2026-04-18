from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from auth import verify_token
from database import get_db

router = APIRouter(tags=["financeiro"])

# ══ BANCOS ═══════════════════════════════════════════════════════════════════

class BancoCreate(BaseModel):
    nome: str
    ordem: int = 0

@router.get("/bancos")
def list_bancos(_: str = Depends(verify_token)):
    return get_db().table("bancos").select("*").order("ordem").execute().data

@router.post("/bancos", status_code=201)
def create_banco(body: BancoCreate, _: str = Depends(verify_token)):
    row = get_db().table("bancos").insert({"nome": body.nome, "ordem": body.ordem}).execute().data
    return row[0] if row else {}

@router.delete("/bancos/{banco_id}", status_code=204)
def delete_banco(banco_id: str, _: str = Depends(verify_token)):
    get_db().table("bancos").delete().eq("id", banco_id).execute()

# ══ CAIXA ════════════════════════════════════════════════════════════════════

class CaixaSaldoItem(BaseModel):
    banco_id: str
    valor: float

class CaixaSnapshotCreate(BaseModel):
    data: str  # YYYY-MM-DD
    saldos: list[CaixaSaldoItem]

@router.get("/caixa")
def get_caixa(_: str = Depends(verify_token)):
    db = get_db()
    # All snapshots with bank name, ordered newest first
    rows = (
        db.table("caixa_snapshots")
        .select("data, valor, banco_id, bancos(nome)")
        .order("data", desc=True)
        .execute()
        .data
    )
    if not rows:
        return {"latest_date": None, "saldo_total": 0, "saldo_por_banco": [], "historico": []}

    latest_date = rows[0]["data"]
    latest = [r for r in rows if r["data"] == latest_date]
    saldo_por_banco = [{"banco_id": r["banco_id"], "nome": r["bancos"]["nome"], "valor": float(r["valor"])} for r in latest]
    saldo_total = sum(s["valor"] for s in saldo_por_banco)

    # Historical totals grouped by date
    from collections import defaultdict
    hist: dict[str, float] = defaultdict(float)
    for r in rows:
        hist[r["data"]] += float(r["valor"])
    historico = [{"data": d, "total": round(t, 2)} for d, t in sorted(hist.items())]

    return {
        "latest_date": latest_date,
        "saldo_total": round(saldo_total, 2),
        "saldo_por_banco": saldo_por_banco,
        "historico": historico,
    }

@router.post("/caixa", status_code=201)
def save_caixa(body: CaixaSnapshotCreate, _: str = Depends(verify_token)):
    db = get_db()
    rows = [{"data": body.data, "banco_id": s.banco_id, "valor": s.valor} for s in body.saldos]
    db.table("caixa_snapshots").upsert(rows, on_conflict="data,banco_id").execute()
    return {"ok": True}

# ══ FATURAS ══════════════════════════════════════════════════════════════════

class CartaoCreate(BaseModel):
    cartao: str
    vencimento: int

class FaturaUpsert(BaseModel):
    cartao: str
    mes: str   # YYYY-MM
    valor: float

@router.get("/faturas/cartoes")
def list_cartoes(_: str = Depends(verify_token)):
    return get_db().table("faturas_cartoes").select("*").order("cartao").execute().data

@router.post("/faturas/cartoes", status_code=201)
def create_cartao(body: CartaoCreate, _: str = Depends(verify_token)):
    row = get_db().table("faturas_cartoes").insert({"cartao": body.cartao, "vencimento": body.vencimento}).execute().data
    return row[0] if row else {}

@router.delete("/faturas/cartoes/{cartao}", status_code=204)
def delete_cartao(cartao: str, _: str = Depends(verify_token)):
    get_db().table("faturas_cartoes").delete().eq("cartao", cartao).execute()

@router.get("/faturas")
def get_faturas(mes: str, _: str = Depends(verify_token)):
    db = get_db()
    cartoes = db.table("faturas_cartoes").select("*").order("cartao").execute().data
    faturas = db.table("faturas").select("*").eq("mes", mes).execute().data
    fat_map = {f["cartao"]: f for f in faturas}
    result = []
    for c in cartoes:
        fat = fat_map.get(c["cartao"], {})
        result.append({
            "cartao": c["cartao"],
            "vencimento": c["vencimento"],
            "valor": float(fat.get("valor", 0)),
        })
    total = sum(r["valor"] for r in result)
    return {"mes": mes, "faturas": result, "total": round(total, 2)}

@router.put("/faturas")
def upsert_fatura(body: FaturaUpsert, _: str = Depends(verify_token)):
    get_db().table("faturas").upsert(
        {"cartao": body.cartao, "mes": body.mes, "valor": body.valor},
        on_conflict="cartao,mes",
    ).execute()
    return {"ok": True}

# ══ FLUXOS RECORRENTES ═══════════════════════════════════════════════════════

class RecorrenteCreate(BaseModel):
    tipo: str
    categoria: str
    descricao: str
    dia: int
    valor: float
    inicio: str      # YYYY-MM
    fim: Optional[str] = None

class RecorrenteUpdate(BaseModel):
    tipo: Optional[str] = None
    categoria: Optional[str] = None
    descricao: Optional[str] = None
    dia: Optional[int] = None
    valor: Optional[float] = None
    inicio: Optional[str] = None
    fim: Optional[str] = None

@router.get("/recorrentes")
def list_recorrentes(_: str = Depends(verify_token)):
    return get_db().table("fluxos_recorrentes").select("*").order("descricao").execute().data

@router.post("/recorrentes", status_code=201)
def create_recorrente(body: RecorrenteCreate, _: str = Depends(verify_token)):
    row = get_db().table("fluxos_recorrentes").insert(body.model_dump(exclude_none=True)).execute().data
    return row[0] if row else {}

@router.patch("/recorrentes/{rec_id}")
def update_recorrente(rec_id: str, body: RecorrenteUpdate, _: str = Depends(verify_token)):
    payload = body.model_dump(exclude_none=True)
    if not payload:
        raise HTTPException(400, "Nenhum campo")
    row = get_db().table("fluxos_recorrentes").update(payload).eq("id", rec_id).execute().data
    return row[0] if row else {}

@router.delete("/recorrentes/{rec_id}", status_code=204)
def delete_recorrente(rec_id: str, _: str = Depends(verify_token)):
    get_db().table("fluxos_recorrentes").delete().eq("id", rec_id).execute()

# ══ FLUXOS PONTUAIS ══════════════════════════════════════════════════════════

class PontualCreate(BaseModel):
    tipo: str
    categoria: str
    descricao: str
    dia: int
    valor: float
    mes_alvo: str  # YYYY-MM

class PontualUpdate(BaseModel):
    tipo: Optional[str] = None
    categoria: Optional[str] = None
    descricao: Optional[str] = None
    dia: Optional[int] = None
    valor: Optional[float] = None
    mes_alvo: Optional[str] = None

@router.get("/pontuais")
def list_pontuais(mes: Optional[str] = None, _: str = Depends(verify_token)):
    q = get_db().table("fluxos_pontuais").select("*").order("dia")
    if mes:
        q = q.eq("mes_alvo", mes)
    return q.execute().data

@router.post("/pontuais", status_code=201)
def create_pontual(body: PontualCreate, _: str = Depends(verify_token)):
    row = get_db().table("fluxos_pontuais").insert(body.model_dump()).execute().data
    return row[0] if row else {}

@router.patch("/pontuais/{pontual_id}")
def update_pontual(pontual_id: str, body: PontualUpdate, _: str = Depends(verify_token)):
    payload = body.model_dump(exclude_none=True)
    if not payload:
        raise HTTPException(400, "Nenhum campo")
    row = get_db().table("fluxos_pontuais").update(payload).eq("id", pontual_id).execute().data
    return row[0] if row else {}

@router.delete("/pontuais/{pontual_id}", status_code=204)
def delete_pontual(pontual_id: str, _: str = Depends(verify_token)):
    get_db().table("fluxos_pontuais").delete().eq("id", pontual_id).execute()

# ══ GASTOS VARIÁVEIS ══════════════════════════════════════════════════════════

class GastoCreate(BaseModel):
    mes: str
    dia: int
    categoria: str
    descricao: str
    valor: float

class GastoUpdate(BaseModel):
    dia: Optional[int] = None
    categoria: Optional[str] = None
    descricao: Optional[str] = None
    valor: Optional[float] = None

@router.get("/gastos")
def list_gastos(mes: str, _: str = Depends(verify_token)):
    return get_db().table("gastos_variaveis").select("*").eq("mes", mes).order("dia").execute().data

@router.post("/gastos", status_code=201)
def create_gasto(body: GastoCreate, _: str = Depends(verify_token)):
    row = get_db().table("gastos_variaveis").insert(body.model_dump()).execute().data
    return row[0] if row else {}

@router.patch("/gastos/{gasto_id}")
def update_gasto(gasto_id: str, body: GastoUpdate, _: str = Depends(verify_token)):
    payload = body.model_dump(exclude_none=True)
    if not payload:
        raise HTTPException(400, "Nenhum campo")
    row = get_db().table("gastos_variaveis").update(payload).eq("id", gasto_id).execute().data
    return row[0] if row else {}

@router.delete("/gastos/{gasto_id}", status_code=204)
def delete_gasto(gasto_id: str, _: str = Depends(verify_token)):
    get_db().table("gastos_variaveis").delete().eq("id", gasto_id).execute()

# ── Orçamento ─────────────────────────────────────────────────────────────────

class OrcamentoUpsert(BaseModel):
    categoria: str
    teto: float
    mes_excecao: Optional[str] = None  # None = regra base

@router.get("/orcamento")
def get_orcamento(_: str = Depends(verify_token)):
    rows = get_db().table("orcamento").select("*").execute().data
    base = {r["categoria"]: float(r["teto"]) for r in rows if r["mes_excecao"] is None}
    excecoes = [{"id": r["id"], "categoria": r["categoria"], "teto": float(r["teto"]), "mes_excecao": r["mes_excecao"]}
                for r in rows if r["mes_excecao"] is not None]
    return {"base": base, "excecoes": excecoes}

@router.put("/orcamento")
def upsert_orcamento(body: OrcamentoUpsert, _: str = Depends(verify_token)):
    get_db().table("orcamento").upsert(
        {"categoria": body.categoria, "teto": body.teto, "mes_excecao": body.mes_excecao},
        on_conflict="categoria,mes_excecao",
    ).execute()
    return {"ok": True}

@router.delete("/orcamento/{orcamento_id}", status_code=204)
def delete_orcamento(orcamento_id: str, _: str = Depends(verify_token)):
    get_db().table("orcamento").delete().eq("id", orcamento_id).execute()

# ══ INVESTIMENTOS ════════════════════════════════════════════════════════════

class AporteCreate(BaseModel):
    mes: str
    dia: int
    classe: str
    ativo: str
    valor: float

@router.get("/aportes")
def list_aportes(mes: Optional[str] = None, _: str = Depends(verify_token)):
    q = get_db().table("aportes").select("*").order("dia")
    if mes:
        q = q.eq("mes", mes)
    return q.execute().data

@router.post("/aportes", status_code=201)
def create_aporte(body: AporteCreate, _: str = Depends(verify_token)):
    row = get_db().table("aportes").insert(body.model_dump()).execute().data
    return row[0] if row else {}

@router.delete("/aportes/{aporte_id}", status_code=204)
def delete_aporte(aporte_id: str, _: str = Depends(verify_token)):
    get_db().table("aportes").delete().eq("id", aporte_id).execute()

class PlanoInvCreate(BaseModel):
    tipo: str    # estrutural | tatico
    classe: str
    valor: float
    mes_alvo: Optional[str] = None

@router.get("/plano-investimento")
def get_plano_inv(_: str = Depends(verify_token)):
    rows = get_db().table("plano_investimento").select("*").execute().data
    estrutural = {r["classe"]: float(r["valor"]) for r in rows if r["tipo"] == "estrutural"}
    tatico = [{"id": r["id"], "classe": r["classe"], "valor": float(r["valor"]), "mes_alvo": r["mes_alvo"]}
              for r in rows if r["tipo"] == "tatico"]
    return {"estrutural": estrutural, "tatico": tatico}

@router.put("/plano-investimento/estrutural")
def upsert_estrutural(body: dict, _: str = Depends(verify_token)):
    # body = {classe: valor, ...}
    db = get_db()
    # delete existing and re-insert
    db.table("plano_investimento").delete().eq("tipo", "estrutural").execute()
    if body:
        rows = [{"tipo": "estrutural", "classe": k, "valor": v} for k, v in body.items()]
        db.table("plano_investimento").insert(rows).execute()
    return {"ok": True}

@router.post("/plano-investimento/tatico", status_code=201)
def create_tatico(body: PlanoInvCreate, _: str = Depends(verify_token)):
    row = get_db().table("plano_investimento").insert(
        {"tipo": "tatico", "classe": body.classe, "valor": body.valor, "mes_alvo": body.mes_alvo}
    ).execute().data
    return row[0] if row else {}

@router.delete("/plano-investimento/{inv_id}", status_code=204)
def delete_plano_inv(inv_id: str, _: str = Depends(verify_token)):
    get_db().table("plano_investimento").delete().eq("id", inv_id).execute()

# ══ TERCEIROS ════════════════════════════════════════════════════════════════

class TerceiroCreate(BaseModel):
    pessoa: str
    origem: str    # pix | cartao
    descricao: str
    mes_alvo: str  # YYYY-MM
    dia: int
    valor: float

class TerceiroUpdate(BaseModel):
    recebido: Optional[bool] = None
    valor: Optional[float] = None
    descricao: Optional[str] = None

@router.get("/terceiros")
def list_terceiros(_: str = Depends(verify_token)):
    return get_db().table("terceiros").select("*").order("mes_alvo", desc=True).execute().data

@router.post("/terceiros", status_code=201)
def create_terceiro(body: TerceiroCreate, _: str = Depends(verify_token)):
    row = get_db().table("terceiros").insert(body.model_dump()).execute().data
    return row[0] if row else {}

@router.patch("/terceiros/{terc_id}")
def update_terceiro(terc_id: str, body: TerceiroUpdate, _: str = Depends(verify_token)):
    payload = body.model_dump(exclude_none=True)
    if not payload:
        raise HTTPException(400, "Nenhum campo")
    row = get_db().table("terceiros").update(payload).eq("id", terc_id).execute().data
    return row[0] if row else {}

@router.delete("/terceiros/{terc_id}", status_code=204)
def delete_terceiro(terc_id: str, _: str = Depends(verify_token)):
    get_db().table("terceiros").delete().eq("id", terc_id).execute()

# ══ DÍVIDAS / PENDÊNCIAS ════════════════════════════════════════════════════

class DividaCreate(BaseModel):
    descricao: str
    valor: float
    mes: str  # YYYY-MM
    dia: int

class DividaUpdate(BaseModel):
    pago: Optional[bool] = None
    valor: Optional[float] = None
    descricao: Optional[str] = None

@router.get("/dividas")
def list_dividas(_: str = Depends(verify_token)):
    return get_db().table("dividas").select("*").order("mes", desc=True).execute().data

@router.post("/dividas", status_code=201)
def create_divida(body: DividaCreate, _: str = Depends(verify_token)):
    row = get_db().table("dividas").insert(body.model_dump()).execute().data
    return row[0] if row else {}

@router.patch("/dividas/{divida_id}")
def update_divida(divida_id: str, body: DividaUpdate, _: str = Depends(verify_token)):
    payload = body.model_dump(exclude_none=True)
    if not payload:
        raise HTTPException(400, "Nenhum campo")
    row = get_db().table("dividas").update(payload).eq("id", divida_id).execute().data
    return row[0] if row else {}

@router.delete("/dividas/{divida_id}", status_code=204)
def delete_divida(divida_id: str, _: str = Depends(verify_token)):
    get_db().table("dividas").delete().eq("id", divida_id).execute()


# ══ DASHBOARD ════════════════════════════════════════════════════════════════

@router.get("/financeiro-dashboard")
def get_financeiro_dashboard(_: str = Depends(verify_token)):
    from datetime import date
    from collections import defaultdict

    db = get_db()

    # Current balance from latest caixa snapshot
    snap_rows = (
        db.table("caixa_snapshots")
        .select("data, valor")
        .order("data", desc=True)
        .execute()
        .data
    )
    saldo_atual = 0.0
    if snap_rows:
        latest_date = snap_rows[0]["data"]
        saldo_atual = sum(float(r["valor"]) for r in snap_rows if r["data"] == latest_date)

    # All recorrentes
    recorrentes = db.table("fluxos_recorrentes").select("*").execute().data

    # Build list of next 6 months (YYYY-MM)
    today = date.today()
    months = []
    for i in range(6):
        total_month = today.month - 1 + i
        y = today.year + total_month // 12
        m = total_month % 12 + 1
        months.append(f"{y:04d}-{m:02d}")

    # Pontuais for those months only
    pontuais = (
        db.table("fluxos_pontuais")
        .select("*")
        .gte("mes_alvo", months[0])
        .lte("mes_alvo", months[-1])
        .execute()
        .data
    )

    # 6-month running projection
    saldo = saldo_atual
    projection = []
    for mes_str in months:
        receita = 0.0
        despesa = 0.0
        for r in recorrentes:
            inicio = r["inicio"]
            fim = r.get("fim")
            if inicio <= mes_str and (fim is None or fim >= mes_str):
                valor = float(r["valor"])
                if r["tipo"] == "Receita":
                    receita += valor
                else:
                    despesa += valor
        for p in pontuais:
            if p["mes_alvo"] == mes_str:
                valor = float(p["valor"])
                if p["tipo"] == "Receita":
                    receita += valor
                else:
                    despesa += valor
        saldo += receita - despesa
        projection.append({
            "mes": mes_str,
            "receita": round(receita, 2),
            "despesa": round(despesa, 2),
            "saldo": round(saldo, 2),
        })

    # Expense distribution for current month
    cur_mes = months[0]
    cat_map: dict[str, float] = defaultdict(float)
    for r in recorrentes:
        if r["tipo"] == "Despesa":
            inicio = r["inicio"]
            fim = r.get("fim")
            if inicio <= cur_mes and (fim is None or fim >= cur_mes):
                cat = r.get("categoria") or "Outros"
                cat_map[cat] += float(r["valor"])
    for p in pontuais:
        if p["tipo"] == "Despesa" and p["mes_alvo"] == cur_mes:
            cat = p.get("categoria") or "Outros"
            cat_map[cat] += float(p["valor"])

    distribuicao = sorted(
        [{"categoria": k, "valor": round(v, 2)} for k, v in cat_map.items()],
        key=lambda x: -x["valor"],
    )

    return {
        "saldo_atual": round(saldo_atual, 2),
        "projection": projection,
        "distribuicao_despesas": distribuicao,
    }
