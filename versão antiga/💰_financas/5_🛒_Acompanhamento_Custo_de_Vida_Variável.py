import streamlit as st
import pandas as pd
import uuid
from datetime import datetime
from data_manager import carregar_tabela, salvar_tabela, get_lista_meses, CATEGORIAS_PADRAO

st.set_page_config(page_title="Custo de Vida | Tesouraria", layout="wide")

st.title("🛒 Custo de Vida Variável")
st.markdown("O seu **Shadow Ledger**. Acompanhe seus gastos do dia a dia sem bagunçar a sua posição de caixa principal.")

lista_meses = get_lista_meses()

# --- CARREGAMENTO E MIGRAÇÃO DE DADOS ---
db_gastos = carregar_tabela("gastos", [])

# Nova estrutura para o Orçamento: Base (Flat) e Exceções (Pontuais)
db_orcamento = carregar_tabela("orcamento", {"base": {}, "excecoes": []})
# Se for o formato antigo, reseta para o novo modelo estruturado
if "base" not in db_orcamento:
    db_orcamento = {"base": {cat: 0.0 for cat in CATEGORIAS_PADRAO}, "excecoes": []}

# Garante que todas as categorias padrão existam na base
for cat in CATEGORIAS_PADRAO:
    if cat not in db_orcamento["base"]:
        db_orcamento["base"][cat] = 0.0

# ==========================================
# 1. SETUP DE METAS (EXPANDER)
# ==========================================
with st.expander("⚙️ Configurar Metas e Tetos de Gasto", expanded=False):
    tab_base, tab_sazonal = st.tabs(["1️⃣ Teto Padrão (Flat)", "2️⃣ Ajustes Sazonais (Exceções)"])
    
    with tab_base:
        st.markdown("Defina o valor constante esperado para cada categoria. **Isso se aplicará a todos os meses.**")
        df_base = pd.DataFrame([{"Categoria": k, "Teto Mensal (R$)": v} for k, v in db_orcamento["base"].items()])
        
        df_base_edit = st.data_editor(
            df_base, 
            column_config={
                "Categoria": st.column_config.TextColumn("Categoria", disabled=True),
                "Teto Mensal (R$)": st.column_config.NumberColumn("Teto Mensal (R$)", step=50.0, format="%.2f")
            },
            hide_index=True,
            use_container_width=True,
            key="ed_base"
        )
        
        if st.button("💾 Salvar Teto Padrão", type="primary"):
            nova_base = {row["Categoria"]: row["Teto Mensal (R$)"] for _, row in df_base_edit.iterrows()}
            db_orcamento["base"] = nova_base
            salvar_tabela("orcamento", db_orcamento)
            st.success("Teto padrão atualizado!")
            st.rerun()

    with tab_sazonal:
        st.markdown("Crie **exceções** para meses específicos (Ex: Aumentar o teto de 'Lazer' e 'Família' em Dezembro).")
        
        with st.form("form_excecao", clear_on_submit=True):
            c1, c2, c3, c4 = st.columns([2, 3, 2, 2])
            mes_exc = c1.selectbox("Mês Alvo", lista_meses)
            cat_exc = c2.selectbox("Categoria", CATEGORIAS_PADRAO)
            val_exc = c3.number_input("Novo Teto (R$)", min_value=0.0, step=50.0, format="%.2f")
            btn_exc = c4.form_submit_button("➕ Adicionar Exceção", type="secondary")
            
            if btn_exc:
                db_orcamento["excecoes"].append({
                    "id": str(uuid.uuid4()), "Mês Alvo": mes_exc, "Categoria": cat_exc, "Novo Teto": val_exc
                })
                salvar_tabela("orcamento", db_orcamento)
                st.success(f"Exceção criada para {cat_exc} em {mes_exc}!")
                st.rerun()
        
        df_exc = pd.DataFrame(db_orcamento["excecoes"]) if db_orcamento["excecoes"] else pd.DataFrame(columns=["id", "Mês Alvo", "Categoria", "Novo Teto"])
        
        if not df_exc.empty:
            df_exc_edit = st.data_editor(
                df_exc,
                column_config={
                    "id": None,
                    "Mês Alvo": st.column_config.SelectboxColumn("Mês Alvo", options=lista_meses),
                    "Categoria": st.column_config.SelectboxColumn("Categoria", options=CATEGORIAS_PADRAO),
                    "Novo Teto": st.column_config.NumberColumn("Novo Teto (R$)", step=50.0, format="%.2f")
                },
                num_rows="dynamic",
                hide_index=True,
                use_container_width=True,
                key="ed_exc"
            )
            
            if st.button("💾 Salvar Alterações Sazonais"):
                regs_exc = df_exc_edit.to_dict(orient="records")
                for r in regs_exc:
                    if pd.isna(r.get("id")) or str(r.get("id")).strip() == "": r["id"] = str(uuid.uuid4())
                db_orcamento["excecoes"] = regs_exc
                salvar_tabela("orcamento", db_orcamento)
                st.success("Ajustes sazonais atualizados!")
                st.rerun()

st.divider()

# ==========================================
# 2. OPERAÇÃO DO MÊS (LANÇAMENTO E DASH)
# ==========================================
col_mes, _ = st.columns([1, 3])
mes_selecionado = col_mes.selectbox("📅 Mês de Execução:", lista_meses)

st.subheader("🚀 Lançamento Rápido")
with st.form("form_novo_gasto", clear_on_submit=True):
    c1, c2, c3, c4 = st.columns([2, 3, 2, 2])
    
    dia_hoje = datetime.now().strftime("%d")
    dia_novo = c1.text_input("Dia", value=dia_hoje, placeholder="Ex: 15")
    desc_nova = c2.text_input("Descrição", placeholder="Ex: Uber, Padaria, Ingresso")
    cat_nova = c3.selectbox("Categoria", CATEGORIAS_PADRAO)
    val_novo = c4.number_input("Valor (R$)", min_value=0.0, step=10.0, format="%.2f")
    
    submit_novo = st.form_submit_button("Registrar Gasto", type="primary")
    
    if submit_novo:
        if not desc_nova.strip() or val_novo == 0:
            st.error("Descrição e valor são obrigatórios!")
        else:
            db_gastos.append({
                "id": str(uuid.uuid4()), "Mês": mes_selecionado, "Dia": dia_novo,
                "Categoria": cat_nova, "Descrição": desc_nova, "Valor": val_novo
            })
            salvar_tabela("gastos", db_gastos)
            st.success(f"Gasto de R$ {val_novo:.2f} registrado em {cat_nova}!")
            st.rerun()

st.divider()

# ==========================================
# 3. PAINEL DE BUDGET (PROGRESSÃO VISUAL)
# ==========================================
st.subheader(f"📊 Orçamento vs. Realizado ({mes_selecionado})")

# Calcula o teto de cada categoria considerando as exceções do mês
teto_ativo = {}
for cat in CATEGORIAS_PADRAO:
    teto_ativo[cat] = db_orcamento["base"].get(cat, 0.0)

for exc in db_orcamento.get("excecoes", []):
    if exc["Mês Alvo"] == mes_selecionado:
        teto_ativo[exc["Categoria"]] = exc["Novo Teto"]

# Filtra gastos do mês
gastos_mes = [g for g in db_gastos if g.get("Mês") == mes_selecionado]
df_gastos_mes = pd.DataFrame(gastos_mes)

# Constrói o Resumo
dados_tabela = []
for cat in CATEGORIAS_PADRAO:
    orcado = teto_ativo[cat]
    realizado = df_gastos_mes[df_gastos_mes["Categoria"] == cat]["Valor"].sum() if not df_gastos_mes.empty else 0.0
    saldo = orcado - realizado
    consumo_pct = (realizado / orcado * 100) if orcado > 0 else (100.0 if realizado > 0 else 0.0)
    
    dados_tabela.append({
        "Categoria": cat,
        "Orçado (R$)": orcado,
        "Realizado (R$)": realizado,
        "Disponível (R$)": saldo,
        "% Consumo": min(consumo_pct, 100.0)
    })

df_resumo = pd.DataFrame(dados_tabela)

# Tabela 100% Automática (Sem edição manual)
st.dataframe(
    df_resumo,
    column_config={
        "Categoria": st.column_config.TextColumn("Categoria", width="medium"),
        "Orçado (R$)": st.column_config.NumberColumn("🎯 Orçado (R$)", format="%.2f", width="small"),
        "Realizado (R$)": st.column_config.NumberColumn("💸 Realizado (R$)", format="%.2f", width="small"),
        "Disponível (R$)": st.column_config.NumberColumn("⚖️ Disponível (R$)", format="%.2f", width="small"),
        "% Consumo": st.column_config.ProgressColumn("🔥 Consumo do Teto", format="%.1f%%", min_value=0.0, max_value=100.0, width="medium")
    },
    use_container_width=True,
    hide_index=True
)

# Métricas Globais
total_orcado = df_resumo["Orçado (R$)"].sum()
total_gasto = df_resumo["Realizado (R$)"].sum()
sobra_total = total_orcado - total_gasto

c1, c2, c3 = st.columns(3)
c1.metric("Teto Total do Mês", f"R$ {total_orcado:,.2f}")
c2.metric("Total Já Gasto", f"R$ {total_gasto:,.2f}", delta=f"{(total_gasto/total_orcado*100):.1f}% do teto" if total_orcado > 0 else None, delta_color="inverse")
c3.metric("Verba Global Restante", f"R$ {sobra_total:,.2f}")

st.divider()

# ==========================================
# 4. EXTRATO DE LANÇAMENTOS (AUDITORIA)
# ==========================================
st.subheader("🧾 Extrato de Gastos do Mês")
if df_gastos_mes.empty:
    st.info("Nenhum gasto registrado neste mês ainda.")
else:
    df_extrato_editado = st.data_editor(
        df_gastos_mes,
        column_config={
            "id": None, "Mês": None,
            "Dia": st.column_config.TextColumn("Dia", width="small"),
            "Categoria": st.column_config.SelectboxColumn("Categoria", options=CATEGORIAS_PADRAO, width="medium"),
            "Descrição": st.column_config.TextColumn("Descrição", width="large"),
            "Valor": st.column_config.NumberColumn("Valor (R$)", step=10.0, format="%.2f", width="small")
        },
        num_rows="dynamic",
        use_container_width=True,
        hide_index=True,
        key="editor_extrato"
    )
    
    if st.button("💾 Salvar Alterações no Extrato", type="secondary"):
        ids_mes = df_gastos_mes["id"].tolist()
        db_restante = [g for g in db_gastos if g["id"] not in ids_mes]
        regs_editados = df_extrato_editado.to_dict(orient="records")
        
        for r in regs_editados:
            r["Mês"] = mes_selecionado 
            if pd.isna(r.get("id")) or str(r.get("id")).strip() == "": r["id"] = str(uuid.uuid4())
                
        salvar_tabela("gastos", db_restante + regs_editados)
        st.success("Extrato atualizado!")
        st.rerun()