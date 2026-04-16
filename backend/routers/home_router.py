from datetime import date, timedelta
from fastapi import APIRouter, Depends
from auth import verify_token
from database import get_db

router = APIRouter(tags=["home"])


@router.get("/home/resumo")
def home_resumo(_: str = Depends(verify_token)):
    db = get_db()
    today = date.today()
    # Start/end of current week (Mon–Sun)
    week_start = today - timedelta(days=today.weekday())
    week_end = week_start + timedelta(days=6)
    # Next 30 days
    next30 = today + timedelta(days=30)
    mes_atual = today.strftime("%Y-%m")
    mes_prox = (today.replace(day=1) + timedelta(days=32)).strftime("%Y-%m")

    # ── Último snapshot de caixa ──────────────────────────────────────────────
    snap_rows = db.table("caixa_snapshots").select("data, valor, bancos(nome)").order("data", desc=True).execute().data
    saldo_total = 0.0
    saldo_por_banco: list[dict] = []
    caixa_data = None

    if snap_rows:
        caixa_data = snap_rows[0]["data"]
        # collect all rows for that date
        latest = [r for r in snap_rows if r["data"] == caixa_data]
        for r in latest:
            nome = r["bancos"]["nome"] if r.get("bancos") else "?"
            saldo_por_banco.append({"nome": nome, "valor": float(r["valor"])})
            saldo_total += float(r["valor"])

    # ── Tarefas da semana ─────────────────────────────────────────────────────
    tarefas_rows = (
        db.table("tarefas")
        .select("id, titulo, prioridade, status, data_limite, frentes(nome, cor)")
        .eq("concluida", False)
        .neq("status", "done")
        .execute()
        .data
    )
    tarefas_semana = []
    tarefas_atrasadas = []
    for t in tarefas_rows:
        frente = t.get("frentes") or {}
        item = {
            "id": t["id"],
            "titulo": t["titulo"],
            "prioridade": t["prioridade"],
            "status": t["status"],
            "data_limite": t.get("data_limite"),
            "frente_nome": frente.get("nome"),
            "frente_cor": frente.get("cor"),
        }
        if t.get("data_limite"):
            dl = date.fromisoformat(t["data_limite"])
            if dl < today:
                tarefas_atrasadas.append(item)
            elif week_start <= dl <= week_end:
                tarefas_semana.append(item)
        else:
            tarefas_semana.append(item)

    # ── Próximas despesas (recorrentes + pontuais, próximos 30 dias) ──────────
    proximas: list[dict] = []

    # Recorrentes ativos nos meses atual/próximo
    rec_rows = db.table("fluxos_recorrentes").select("*").eq("tipo", "Despesa").execute().data
    for r in rec_rows:
        for mes in (mes_atual, mes_prox):
            if r["inicio"] <= mes and (r["fim"] is None or r["fim"] >= mes):
                ano, m = int(mes[:4]), int(mes[5:])
                try:
                    item_date = date(ano, m, min(r["dia"], 28))
                except ValueError:
                    continue
                if today <= item_date <= next30:
                    proximas.append({
                        "descricao": r["descricao"],
                        "categoria": r["categoria"],
                        "valor": float(r["valor"]),
                        "data": item_date.isoformat(),
                        "tipo": "recorrente",
                    })

    # Pontuais nos meses atual/próximo
    pont_rows = (
        db.table("fluxos_pontuais")
        .select("*")
        .eq("tipo", "Despesa")
        .in_("mes_alvo", [mes_atual, mes_prox])
        .execute()
        .data
    )
    for r in pont_rows:
        mes = r["mes_alvo"]
        ano, m = int(mes[:4]), int(mes[5:])
        try:
            item_date = date(ano, m, min(r["dia"], 28))
        except ValueError:
            continue
        if today <= item_date <= next30:
            proximas.append({
                "descricao": r["descricao"],
                "categoria": r["categoria"],
                "valor": float(r["valor"]),
                "data": item_date.isoformat(),
                "tipo": "pontual",
            })

    proximas.sort(key=lambda x: x["data"])

    return {
        "saldo_total": round(saldo_total, 2),
        "saldo_por_banco": saldo_por_banco,
        "caixa_data": caixa_data,
        "tarefas_semana": tarefas_semana,
        "tarefas_atrasadas": tarefas_atrasadas,
        "proximas_despesas": proximas[:20],
    }
