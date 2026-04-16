import streamlit as st
import pandas as pd
import uuid
from datetime import datetime
from data_manager import carregar_tabela, salvar_tabela, get_lista_meses

st.set_page_config(page_title="Investimentos | Tesouraria", layout="wide")

# --- CLASSES DE ATIVOS (ASSET ALLOCATION) ---
CLASSES_ATIVOS = [
    "Liquidez / Reserva", 
    "Renda Fixa (Pós-Fixada)", 
    "Renda Fixa (Pré/Inflação)", 
    "Renda Variável (Brasil)", 
    "Renda Variável (Exterior)", 
    "Fundos Imobiliários (FIIs)", 
    "Alternativos / Multimercado", 
    "Criptoativos"
]

st.title("📈 Plano de Investimentos")
st.markdown("O seu módulo de **Pay Yourself First**. Defina a meta de aportes por classe de ativo e registre as execuções (boletas) do mês.")

lista_meses = get_lista_meses()

# --- CARREGAMENTO DE DADOS ---
db_aportes = carregar_tabela("aportes_realizados", [])
db_plano = carregar_tabela("plano_investimento", {"estrutural": {}, "tatico": []})

if "estrutural" not in db_plano:
    db_plano = {"estrutural": {classe: 0.0 for classe in CLASSES_ATIVOS}, "tatico": []}

for classe in CLASSES_ATIVOS:
    if classe not in db_plano["estrutural"]:
        db_plano["estrutural"][classe] = 0.0

# ==========================================
# 1. SETUP DE ALOCAÇÃO (EXPANDER)
# ==========================================
with st.expander("⚙️ Configurar Metas de Aporte (Asset Allocation)", expanded=False):
    tab_est, tab_tac = st.tabs(["1️⃣ Alocação Estrutural (Mensal Fixo)", "2️⃣ Alocação Tática (Aportes Pontuais)"])
    
    with tab_est:
        st.markdown("Defina o valor base que você pretende aportar todos os meses em cada classe.")
        df_est = pd.DataFrame([{"Classe": k, "Meta Mensal (R$)": v} for k, v in db_plano["estrutural"].items()])
        
        df_est_edit = st.data_editor(
            df_est, 
            column_config={
                "Classe": st.column_config.TextColumn("Classe de Ativo", disabled=True),
                "Meta Mensal (R$)": st.column_config.NumberColumn("Meta Mensal (R$)", step=100.0, format="%.2f")
            },
            hide_index=True,
            use_container_width=True,
            key="ed_est"
        )
        
        if st.button("💾 Salvar Alocação Estrutural", type="primary"):
            novo_estrutural = {row["Classe"]: row["Meta Mensal (R$)"] for _, row in df_est_edit.iterrows()}
            db_plano["estrutural"] = novo_estrutural
            salvar_tabela("plano_investimento", db_plano)
            st.success("Plano estrutural atualizado!")
            st.rerun()

    with tab_tac:
        st.markdown("Aportes extraordinários (ex: PLR, Bônus, resgates que serão reinvestidos).")
        
        with st.form("form_tatico", clear_on_submit=True):
            c1, c2, c3, c4 = st.columns([2, 3, 2, 2])
            mes_tac = c1.selectbox("Mês Alvo", lista_meses)
            classe_tac = c2.selectbox("Classe", CLASSES_ATIVOS)
            val_tac = c3.number_input("Aporte Adicional (R$)", min_value=0.0, step=100.0, format="%.2f")
            btn_tac = c4.form_submit_button("➕ Adicionar Aporte Tático", type="secondary")
            
            if btn_tac:
                db_plano["tatico"].append({
                    "id": str(uuid.uuid4()), "Mês Alvo": mes_tac, "Classe": classe_tac, "Valor Extra": val_tac
                })
                salvar_tabela("plano_investimento", db_plano)
                st.success(f"Aporte tático criado para {classe_tac} em {mes_tac}!")
                st.rerun()
        
        df_tac = pd.DataFrame(db_plano["tatico"]) if db_plano["tatico"] else pd.DataFrame(columns=["id", "Mês Alvo", "Classe", "Valor Extra"])
        
        if not df_tac.empty:
            df_tac_edit = st.data_editor(
                df_tac,
                column_config={
                    "id": None,
                    "Mês Alvo": st.column_config.SelectboxColumn("Mês Alvo", options=lista_meses),
                    "Classe": st.column_config.SelectboxColumn("Classe", options=CLASSES_ATIVOS),
                    "Valor Extra": st.column_config.NumberColumn("Valor Extra (R$)", step=100.0, format="%.2f")
                },
                num_rows="dynamic",
                hide_index=True,
                use_container_width=True,
                key="ed_tac"
            )
            
            if st.button("💾 Salvar Alterações Táticas"):
                regs_tac = df_tac_edit.to_dict(orient="records")
                for r in regs_tac:
                    if pd.isna(r.get("id")) or str(r.get("id")).strip() == "": r["id"] = str(uuid.uuid4())
                db_plano["tatico"] = regs_tac
                salvar_tabela("plano_investimento", db_plano)
                st.success("Ajustes táticos atualizados!")
                st.rerun()

st.divider()

# ==========================================
# 2. OPERAÇÃO DO MÊS
# ==========================================
col_mes, _ = st.columns([1, 3])
mes_selecionado = col_mes.selectbox("📅 Mês de Execução:", lista_meses)

st.subheader("🚀 Registrar Boleta (Aporte Realizado)")
with st.form("form_novo_aporte", clear_on_submit=True):
    c1, c2, c3, c4 = st.columns([2, 3, 2, 2])
    
    dia_hoje = datetime.now().strftime("%d")
    dia_novo = c1.text_input("Dia", value=dia_hoje, placeholder="Ex: 05")
    desc_nova = c2.text_input("Ativo / Corretora", placeholder="Ex: IVVB11, Tesouro IPCA+, XP")
    classe_nova = c3.selectbox("Classe de Ativo", CLASSES_ATIVOS)
    val_novo = c4.number_input("Valor Aportado (R$)", min_value=0.0, step=100.0, format="%.2f")
    
    submit_novo = st.form_submit_button("Registrar Aporte", type="primary")
    
    if submit_novo:
        if not desc_nova.strip() or val_novo == 0:
            st.error("Ativo e valor são obrigatórios!")
        else:
            db_aportes.append({
                "id": str(uuid.uuid4()), "Mês": mes_selecionado, "Dia": dia_novo,
                "Classe": classe_nova, "Ativo": desc_nova, "Valor": val_novo
            })
            salvar_tabela("aportes_realizados", db_aportes)
            st.success(f"Aporte de R$ {val_novo:.2f} registrado em {classe_nova}!")
            st.rerun()

st.divider()

# ==========================================
# 3. DASHBOARD DE CONVERGÊNCIA
# ==========================================
st.subheader(f"📊 Planejado vs. Realizado ({mes_selecionado})")

# Consolida a Meta (Estrutural + Tático do Mês)
meta_ativa = {classe: db_plano["estrutural"].get(classe, 0.0) for classe in CLASSES_ATIVOS}
for tac in db_plano.get("tatico", []):
    if tac["Mês Alvo"] == mes_selecionado:
        meta_ativa[tac["Classe"]] += tac["Valor Extra"]

# Consolida os aportes realizados
aportes_mes = [a for a in db_aportes if a.get("Mês") == mes_selecionado]
df_aportes_mes = pd.DataFrame(aportes_mes)

dados_tabela = []
for classe in CLASSES_ATIVOS:
    meta = meta_ativa[classe]
    realizado = df_aportes_mes[df_aportes_mes["Classe"] == classe]["Valor"].sum() if not df_aportes_mes.empty else 0.0
    gap = meta - realizado
    
    # Progresso (trava em 100% no visual para não quebrar a barra, mas o Delta na métrica mostra a verdade)
    progresso_pct = (realizado / meta * 100) if meta > 0 else (100.0 if realizado > 0 else 0.0)
    
    dados_tabela.append({
        "Classe de Ativo": classe,
        "Meta (R$)": meta,
        "Aportado (R$)": realizado,
        "Gap (R$)": gap if gap > 0 else 0.0,
        "% Concluído": min(progresso_pct, 100.0)
    })

df_resumo = pd.DataFrame(dados_tabela)

# Tabela Dashboard
st.dataframe(
    df_resumo,
    column_config={
        "Classe de Ativo": st.column_config.TextColumn("Classe de Ativo", width="medium"),
        "Meta (R$)": st.column_config.NumberColumn("🎯 Meta (R$)", format="%.2f", width="small"),
        "Aportado (R$)": st.column_config.NumberColumn("📈 Aportado (R$)", format="%.2f", width="small"),
        "Gap (R$)": st.column_config.NumberColumn("⚠️ Falta Aportar (R$)", format="%.2f", width="small"),
        "% Concluído": st.column_config.ProgressColumn("🚀 Progresso", format="%.1f%%", min_value=0.0, max_value=100.0, width="medium")
    },
    use_container_width=True,
    hide_index=True
)

# Métricas Globais de Investimento
total_meta = df_resumo["Meta (R$)"].sum()
total_aportado = df_resumo["Aportado (R$)"].sum()
conclusao_global = (total_aportado / total_meta * 100) if total_meta > 0 else 0.0

c1, c2, c3 = st.columns(3)
c1.metric("Meta Total de Aportes", f"R$ {total_meta:,.2f}")
c2.metric("Total Aportado", f"R$ {total_aportado:,.2f}", delta=f"{conclusao_global:.1f}% da meta atingida", delta_color="normal")
c3.metric("Falta para a Meta", f"R$ {max(0, total_meta - total_aportado):,.2f}")

st.divider()

# ==========================================
# 4. EXTRATO DE BOLETAS (AUDITORIA)
# ==========================================
st.subheader("🧾 Histórico de Boletas do Mês")
if df_aportes_mes.empty:
    st.info("Nenhum aporte registrado neste mês ainda.")
else:
    df_extrato_editado = st.data_editor(
        df_aportes_mes,
        column_config={
            "id": None, "Mês": None,
            "Dia": st.column_config.TextColumn("Dia", width="small"),
            "Classe": st.column_config.SelectboxColumn("Classe", options=CLASSES_ATIVOS, width="medium"),
            "Ativo": st.column_config.TextColumn("Ativo / Corretora", width="large"),
            "Valor": st.column_config.NumberColumn("Valor (R$)", step=100.0, format="%.2f", width="small")
        },
        num_rows="dynamic",
        use_container_width=True,
        hide_index=True,
        key="editor_aportes"
    )
    
    if st.button("💾 Salvar Alterações no Extrato", type="secondary"):
        ids_mes = df_aportes_mes["id"].tolist()
        db_restante = [a for a in db_aportes if a["id"] not in ids_mes]
        regs_editados = df_extrato_editado.to_dict(orient="records")
        
        for r in regs_editados:
            r["Mês"] = mes_selecionado 
            if pd.isna(r.get("id")) or str(r.get("id")).strip() == "": r["id"] = str(uuid.uuid4())
                
        salvar_tabela("aportes_realizados", db_restante + regs_editados)
        st.success("Histórico de aportes atualizado!")
        st.rerun()