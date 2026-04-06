import streamlit as st
import pandas as pd
import uuid
from data_manager import carregar_tabela, salvar_tabela, get_lista_meses, CATEGORIAS_PADRAO

st.set_page_config(page_title="Pontuais | Tesouraria", layout="wide")

st.title("🎯 Eventos Pontuais")
st.markdown("Provisione eventos isolados (IPVA, viagens, bônus). Use o formulário para adicionar novos e o filtro para não se perder em planilhas gigantes.")

lista_meses = get_lista_meses()
db_pon = carregar_tabela("pontuais", [])

# --- 1. FORMULÁRIO DE ADIÇÃO RÁPIDA (USER FRIENDLY) ---
with st.expander("➕ Adicionar Novo Evento Pontual", expanded=True):
    with st.form("form_novo_pontual", clear_on_submit=True):
        c1, c2, c3 = st.columns([2, 2, 3])
        tipo_novo = c1.selectbox("Tipo", ["Saída", "Entrada"])
        mes_novo = c2.selectbox("Mês Alvo", lista_meses)
        cat_nova = c3.selectbox("Categoria", CATEGORIAS_PADRAO)
        
        c4, c5, c6 = st.columns([4, 1, 2])
        desc_nova = c4.text_input("Descrição", placeholder="Ex: IPVA do Carro")
        dia_novo = c5.text_input("Dia", placeholder="Ex: 15")
        val_novo = c6.number_input("Valor (R$)", min_value=0.0, step=50.0, format="%.2f")
        
        submit_novo = st.form_submit_button("Adicionar Lançamento", type="primary")
        
        if submit_novo:
            if not desc_nova.strip() or val_novo == 0:
                st.error("A descrição e o valor são obrigatórios!")
            else:
                novo_registro = {
                    "id": str(uuid.uuid4()),
                    "Tipo": tipo_novo,
                    "Categoria": cat_nova,
                    "Descrição": desc_nova,
                    "Dia": dia_novo,
                    "Valor": val_novo,
                    "Mês Alvo": mes_novo
                }
                db_pon.append(novo_registro)
                salvar_tabela("pontuais", db_pon)
                st.success(f"Lançamento '{desc_nova}' adicionado com sucesso em {mes_novo}!")
                st.rerun()

st.divider()

# --- 2. GESTÃO E FILTROS ---
st.subheader("📋 Gerenciar Lançamentos Existentes")

# Controle do Filtro
opcoes_filtro = ["Todos os Meses"] + lista_meses
mes_filtro = st.selectbox("Filtre a tabela pelo mês desejado:", opcoes_filtro)

# Converte o banco em DataFrame para facilitar a filtragem
df_full = pd.DataFrame(db_pon) if db_pon else pd.DataFrame(columns=["id", "Tipo", "Categoria", "Descrição", "Dia", "Valor", "Mês Alvo"])
if "Categoria" not in df_full.columns:
    df_full.insert(2, "Categoria", "Outros")

# Aplica o Filtro Temporal
if mes_filtro == "Todos os Meses":
    df_view = df_full.copy()
else:
    df_view = df_full[df_full["Mês Alvo"] == mes_filtro].copy()

# Separa as tabelas
df_in = df_view[df_view["Tipo"] == "Entrada"].copy()
df_out = df_view[df_view["Tipo"] == "Saída"].copy()

# --- MÉTRICAS (Refletem o mês selecionado) ---
total_in = df_in['Valor'].sum() if not df_in.empty else 0.0
total_out = df_out['Valor'].sum() if not df_out.empty else 0.0

c1, c2, c3 = st.columns(3)
titulo_metrica = "no Mês" if mes_filtro != "Todos os Meses" else "Totais"
c1.metric(f"Entradas ({titulo_metrica})", f"R$ {total_in:,.2f}")
c2.metric(f"Saídas ({titulo_metrica})", f"R$ {total_out:,.2f}")
c3.metric(f"Balanço ({titulo_metrica})", f"R$ {(total_in - total_out):,.2f}")

# --- 3. EDIÇÃO DAS TABELAS (Apenas a visão filtrada) ---
config = {
    "id": None,
    "Tipo": None,
    "Categoria": st.column_config.SelectboxColumn("Categoria", options=CATEGORIAS_PADRAO, width="medium"),
    "Descrição": st.column_config.TextColumn("Descrição", width="large"),
    "Dia": st.column_config.TextColumn("Dia", width="small"),
    "Mês Alvo": st.column_config.SelectboxColumn("Mês", options=lista_meses, width="small"),
    "Valor": st.column_config.NumberColumn("Valor (R$)", step=100.0, format="%.2f", width="medium")
}

st.markdown("*(Você ainda pode alterar valores diretamente na tabela abaixo ou usar as lixeiras na última coluna para apagar)*")

st.write("🟢 **Entradas Extras**")
df_in_editado = st.data_editor(df_in, column_config=config, num_rows="dynamic", use_container_width=True, hide_index=True, key="ed_in")

st.write("🔴 **Gastos Provisionados**")
df_out_editado = st.data_editor(df_out, column_config=config, num_rows="dynamic", use_container_width=True, hide_index=True, key="ed_out")

st.markdown("<br>", unsafe_allow_html=True)

# Lógica robusta de merge (Combina dados filtrados com os ocultos)
if st.button("💾 Salvar Alterações nas Tabelas"):
    # Descobre os IDs que estavam na tela antes da edição
    ids_na_view = df_view["id"].tolist() if not df_view.empty else []
    
    # Guarda os dados do banco que NÃO estão no filtro atual
    db_restante = [r for r in db_pon if r["id"] not in ids_na_view]
    
    # Extrai as edições feitas
    regs_in = df_in_editado.to_dict(orient="records")
    regs_out = df_out_editado.to_dict(orient="records")
    
    # Injeta a coluna "Tipo" e garante que novas linhas ganhem IDs
    for r in regs_in:
        r["Tipo"] = "Entrada"
        if pd.isna(r.get("id")) or str(r.get("id")).strip() == "": r["id"] = str(uuid.uuid4())
    for r in regs_out:
        r["Tipo"] = "Saída"
        if pd.isna(r.get("id")) or str(r.get("id")).strip() == "": r["id"] = str(uuid.uuid4())
        
    # Junta os dados intocados com os dados editados
    db_final = db_restante + regs_in + regs_out
    salvar_tabela("pontuais", db_final)
    
    st.success("Tabelas atualizadas com sucesso!")
    st.rerun()