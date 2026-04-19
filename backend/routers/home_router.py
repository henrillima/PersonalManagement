from datetime import date, timedelta
from fastapi import APIRouter, Depends
from auth import verify_token
from database import get_db

router = APIRouter(tags=["home"])


@router.get("/home/resumo")
def home_resumo(_: str = Depends(verify_token)):
    db = get_db()
    today = date.today()
    week_start = today - timedelta(days=today.weekday())
    week_end   = week_start + timedelta(days=6)
    next30     = today + timedelta(days=30)
    mes_atual  = today.strftime("%Y-%m")
    mes_prox   = (today.replace(day=1) + timedelta(days=32)).strftime("%Y-%m")

    # ── Caixa ────────────────────────────────────────────────────────────────
    snap_rows = db.table("caixa_snapshots").select("data, valor, bancos(nome)").order("data", desc=True).execute().data
    saldo_total = 0.0
    saldo_por_banco: list[dict] = []
    caixa_data = None
    if snap_rows:
        caixa_data = snap_rows[0]["data"]
        for r in [r for r in snap_rows if r["data"] == caixa_data]:
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
            "fonte": "tarefa",
        }
        if t.get("data_limite"):
            dl = date.fromisoformat(t["data_limite"])
            if dl < today:
                tarefas_atrasadas.append(item)
            elif week_start <= dl <= week_end:
                tarefas_semana.append(item)
        else:
            tarefas_semana.append(item)

    # Recorrentes da semana
    try:
        rec_ocs = (
            db.table("tarefas_recorrentes_ocorrencias")
            .select("id, titulo, prioridade, concluida, data_alvo, categoria")
            .gte("data_alvo", week_start.isoformat())
            .lte("data_alvo", week_end.isoformat())
            .eq("concluida", False)
            .execute()
            .data
        )
        for oc in rec_ocs:
            tarefas_semana.append({
                "id": f"rec_{oc['id']}",
                "titulo": oc["titulo"],
                "prioridade": oc.get("prioridade", "media"),
                "status": "todo",
                "data_limite": oc.get("data_alvo"),
                "frente_nome": None,
                "frente_cor": None,
                "fonte": "recorrente",
            })
    except Exception:
        pass

    # ── Próximas despesas (30 dias) — todas as fontes ─────────────────────────
    proximas: list[dict] = []

    # Recorrentes
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

    # Pontuais
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

    # Faturas de cartão
    try:
        venc_map = {
            c["cartao"]: c["vencimento"]
            for c in db.table("faturas_cartoes").select("cartao, vencimento").execute().data
        }
        fat_rows = (
            db.table("faturas")
            .select("cartao, mes, valor, pago")
            .in_("mes", [mes_atual, mes_prox])
            .eq("pago", False)
            .execute()
            .data
        )
        for f in fat_rows:
            venc_dia = venc_map.get(f["cartao"], 10)
            mes = f["mes"]
            ano, m_num = int(mes[:4]), int(mes[5:])
            try:
                item_date = date(ano, m_num, min(venc_dia, 28))
            except ValueError:
                continue
            if today <= item_date <= next30:
                proximas.append({
                    "descricao": f"Fatura {f['cartao']}",
                    "categoria": "Faturas Cartão",
                    "valor": float(f["valor"]),
                    "data": item_date.isoformat(),
                    "tipo": "fatura",
                })
    except Exception:
        pass

    # Dívidas
    try:
        div_rows = (
            db.table("dividas")
            .select("descricao, mes, dia, valor, pago")
            .eq("pago", False)
            .in_("mes", [mes_atual, mes_prox])
            .execute()
            .data
        )
        for d in div_rows:
            mes = d["mes"]
            ano, m_num = int(mes[:4]), int(mes[5:])
            try:
                item_date = date(ano, m_num, min(d.get("dia", 10), 28))
            except ValueError:
                continue
            if today <= item_date <= next30:
                proximas.append({
                    "descricao": d["descricao"],
                    "categoria": "Dívidas",
                    "valor": float(d["valor"]),
                    "data": item_date.isoformat(),
                    "tipo": "divida",
                })
    except Exception:
        pass

    # Terceiros a pagar
    try:
        terc_rows = (
            db.table("terceiros")
            .select("descricao, mes_alvo, dia, valor, pago, direcao")
            .eq("direcao", "a_pagar")
            .eq("pago", False)
            .in_("mes_alvo", [mes_atual, mes_prox])
            .execute()
            .data
        )
        for t in terc_rows:
            mes = t["mes_alvo"]
            ano, m_num = int(mes[:4]), int(mes[5:])
            try:
                item_date = date(ano, m_num, min(t.get("dia", 10), 28))
            except ValueError:
                continue
            if today <= item_date <= next30:
                proximas.append({
                    "descricao": t["descricao"],
                    "categoria": "A Pagar (Terceiros)",
                    "valor": float(t["valor"]),
                    "data": item_date.isoformat(),
                    "tipo": "terceiro",
                })
    except Exception:
        pass

    proximas.sort(key=lambda x: x["data"])

    return {
        "saldo_total": round(saldo_total, 2),
        "saldo_por_banco": saldo_por_banco,
        "caixa_data": caixa_data,
        "tarefas_semana": tarefas_semana,
        "tarefas_atrasadas": tarefas_atrasadas,
        "proximas_despesas": proximas[:20],
    }
