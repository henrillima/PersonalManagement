import streamlit as st
import pandas as pd
import uuid
from data_manager import carregar_tabela, salvar_tabela, get_lista_meses, CATEGORIAS_PADRAO

st.set_page_config(page_title="Recorrentes | Tesouraria", layout="wide")

# --- CABEÇALHO E UI ---
st.title("🔁 Contratos Recorrentes")
st.markdown("Cadastre obrigações e receitas de vida longa (Salário, Assinaturas, Aluguel). Use o formulário para adicionar novos e o filtro para gerenciar os ativos em um mês específico.")

lista_meses = get_lista_meses()
opcoes_fim = lista_meses + ["2099-12"]
db_rec = carregar_tabela("recorrentes", [])

# --- 1. FORMULÁRIO DE ADIÇÃO RÁPIDA (USER FRIENDLY) ---
with st.expander("➕ Adicionar Novo Contrato Recorrente", expanded=True):
    with st.form("form_novo_rec", clear_on_submit=True):
        c1, c2, c3, c4 = st.columns([2, 2, 2, 3])
        tipo_novo = c1.selectbox("Tipo", ["Saída", "Entrada"])
        inicio_novo = c2.selectbox("Mês Início", lista_meses)
        fim_novo = c3.selectbox("Mês Fim", opcoes_fim, index=len(opcoes_fim)-1, help="Deixe 2099-12 se não tiver prazo para acabar")
        cat_nova = c4.selectbox("Categoria", CATEGORIAS_PADRAO)
        
        c5, c6, c7 = st.columns([4, 1, 2])
        desc_nova = c5.text_input("Descrição", placeholder="Ex: Aluguel, Salário, Spotify")
        dia_novo = c6.text_input("Dia", placeholder="Ex: 05")
        val_novo = c7.number_input("Valor (R$)", min_value=0.0, step=50.0, format="%.2f")
        
        submit_novo = st.form_submit_button("Adicionar Contrato", type="primary")
        
        if submit_novo:
            if not desc_nova.strip() or val_novo == 0:
                st.error("A descrição e o valor são obrigatórios!")
            elif inicio_novo > fim_novo:
                st.error("O mês de Início não pode ser maior que o mês de Fim!")
            else:
                novo_registro = {
                    "id": str(uuid.uuid4()),
                    "Tipo": tipo_novo,
                    "Categoria": cat_nova,
                    "Descrição": desc_nova,
                    "Dia": dia_novo,
                    "Valor": val_novo,
                    "Início": inicio_novo,
                    "Fim": fim_novo
                }
                db_rec.append(novo_registro)
                salvar_tabela("recorrentes", db_rec)
                st.success(f"Contrato '{desc_nova}' adicionado com sucesso!")
                st.rerun()

st.divider()

# --- 2. GESTÃO E FILTROS ---
st.subheader("📋 Gerenciar Contratos Existentes")

opcoes_filtro = ["Todos os Meses"] + lista_meses
mes_filtro = st.selectbox("Filtre a tabela por contratos ativos no mês:", opcoes_filtro)

df_full = pd.DataFrame(db_rec) if db_rec else pd.DataFrame(columns=["id", "Tipo", "Categoria", "Descrição", "Dia", "Valor", "Início", "Fim"])

if "Categoria" not in df_full.columns:
    df_full.insert(2, "Categoria", "Outros")

# Aplica o Filtro Temporal (O contrato deve estar ativo no mês filtrado)
if mes_filtro == "Todos os Meses":
    df_view = df_full.copy()
else:
    # Filtra onde Início <= mes_filtro e Fim >= mes_filtro
    df_view = df_full[(df_full["Início"] <= mes_filtro) & (df_full["Fim"] >= mes_filtro)].copy()

# Filtra os dados para as duas tabelas
df_in = df_view[df_view["Tipo"] == "Entrada"].copy()
df_out = df_view[df_view["Tipo"] == "Saída"].copy()

# --- MÉTRICAS DE RESUMO ---
entradas_ativas = df_in['Valor'].sum() if not df_in.empty else 0.0
saidas_ativas = df_out['Valor'].sum() if not df_out.empty else 0.0

c1, c2, c3 = st.columns(3)
titulo_metrica = "Ativas no Mês" if mes_filtro != "Todos os Meses" else "Totais"
c1.metric(f"Receitas Recorrentes ({titulo_metrica})", f"R$ {entradas_ativas:,.2f}")
c2.metric(f"Despesas Fixas ({titulo_metrica})", f"R$ {saidas_ativas:,.2f}")
c3.metric(f"Saldo Estrutural ({titulo_metrica})", f"R$ {(entradas_ativas - saidas_ativas):,.2f}")

st.markdown("<br>", unsafe_allow_html=True)

# --- 3. EDIÇÃO DAS TABELAS (Visão filtrada) ---
config = {
    "id": None, 
    "Tipo": None, 
    "Categoria": st.column_config.SelectboxColumn("Categoria", options=CATEGORIAS_PADRAO, width="medium"),
    "Descrição": st.column_config.TextColumn("Descrição", width="large"),
    "Dia": st.column_config.TextColumn("Dia", width="small", help="Dia de vencimento"),
    "Início": st.column_config.SelectboxColumn("Início", options=opcoes_fim, width="medium"),
    "Fim": st.column_config.SelectboxColumn("Fim", options=opcoes_fim, width="medium"),
    "Valor": st.column_config.NumberColumn("Valor (R$)", step=100.0, format="%.2f", width="medium")
}

st.markdown("*(Edite os valores abaixo ou use as lixeiras na última coluna para remover contratos)*")

st.write("🟢 **Entradas Recorrentes**")
df_in_editado = st.data_editor(df_in, column_config=config, num_rows="dynamic", use_container_width=True, hide_index=True, key="ed_rec_in")

st.write("🔴 **Despesas Fixas (Saídas)**")
df_out_editado = st.data_editor(df_out, column_config=config, num_rows="dynamic", use_container_width=True, hide_index=True, key="ed_rec_out")

st.markdown("<br>", unsafe_allow_html=True)

# --- LÓGICA DE SALVAMENTO INTELIGENTE ---
if st.button("💾 Salvar Alterações nas Tabelas", type="primary"):
    # Pega os IDs que estão atualmente visíveis na tela
    ids_na_view = df_view["id"].tolist() if not df_view.empty else []
    
    # Mantém os registros que estavam ocultos pelo filtro
    db_restante = [r for r in db_rec if r["id"] not in ids_na_view]
    
    # Extrai as edições
    regs_in = df_in_editado.to_dict(orient="records")
    regs_out = df_out_editado.to_dict(orient="records")
    
    for r in regs_in:
        r["Tipo"] = "Entrada"
        if pd.isna(r.get("id")) or str(r.get("id")).strip() == "": r["id"] = str(uuid.uuid4())
            
    for r in regs_out:
        r["Tipo"] = "Saída"
        if pd.isna(r.get("id")) or str(r.get("id")).strip() == "": r["id"] = str(uuid.uuid4())
            
    # Junta os dados intocados com os dados editados
    db_final = db_restante + regs_in + regs_out
    salvar_tabela("recorrentes", db_final)
    
    st.success("Tabelas atualizadas com sucesso!")
    st.rerun()