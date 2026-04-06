import streamlit as st
import pandas as pd
from data_manager import carregar_tabela, salvar_tabela, get_lista_meses

st.set_page_config(page_title="Faturas | Tesouraria", layout="wide")

# --- CABEÇALHO ---
st.title("💳 Gestão de Faturas")
st.markdown("Atualize o valor fechado das suas faturas ou adicione novos cartões de forma intuitiva.")

lista_meses = get_lista_meses()
padrao_faturas = [{"Cartão": "XP", "Venc": "10"}, {"Cartão": "Nubank", "Venc": "05"}]

for m in lista_meses:
    padrao_faturas[0][m] = 0.0
    padrao_faturas[1][m] = 0.0

db_faturas = carregar_tabela("faturas", padrao_faturas)

# Garante que as colunas dos meses futuros existam se o tempo virou
for fat in db_faturas:
    for m in lista_meses:
        if m not in fat: fat[m] = 0.0

# --- 1. MÉTRICAS DE RESUMO ---
df_fat = pd.DataFrame(db_faturas)
mes_atual = lista_meses[0]
total_mes_atual = df_fat[mes_atual].sum() if not df_fat.empty else 0.0
total_acumulado = df_fat[lista_meses].sum().sum() if not df_fat.empty else 0.0

c1, c2, c3 = st.columns(3)
c1.metric(f"Total Faturas ({mes_atual})", f"R$ {total_mes_atual:,.2f}")
c2.metric("Dívida Total Parcelada (Projetada)", f"R$ {total_acumulado:,.2f}")
c3.metric("Cartões Cadastrados", f"{len(df_fat)}")

st.divider()

# --- 2. ÁREA DE INPUTS RÁPIDOS ---
col_input, col_novo_cartao = st.columns(2)

cartoes_cadastrados = [fat["Cartão"] for fat in db_faturas]

with col_input:
    st.subheader("🎯 Lançar ou Atualizar Fatura")
    with st.form("form_lancar_fatura", clear_on_submit=True):
        c_cartao, c_mes = st.columns(2)
        cartao_sel = c_cartao.selectbox("Selecione o Cartão", cartoes_cadastrados)
        mes_sel = c_mes.selectbox("Mês de Vencimento", lista_meses)
        
        valor_fatura = st.number_input("Valor da Fatura (R$)", min_value=0.0, step=100.0, format="%.2f")
        
        submit_fatura = st.form_submit_button("Atualizar Valor", type="primary")
        
        if submit_fatura:
            for fat in db_faturas:
                if fat["Cartão"] == cartao_sel:
                    fat[mes_sel] = valor_fatura
                    break
            salvar_tabela("faturas", db_faturas)
            st.success(f"Fatura do {cartao_sel} para {mes_sel} atualizada para R$ {valor_fatura:,.2f}!")
            st.rerun()

with col_novo_cartao:
    st.subheader("💳 Adicionar Novo Cartão")
    with st.form("form_novo_cartao", clear_on_submit=True):
        novo_nome = st.text_input("Nome do Banco / Cartão", placeholder="Ex: Itaú, BTG, Inter")
        novo_venc = st.text_input("Dia do Vencimento", placeholder="Ex: 15")
        
        submit_cartao = st.form_submit_button("Cadastrar Cartão", type="secondary")
        
        if submit_cartao:
            if not novo_nome.strip() or not novo_venc.strip():
                st.error("O nome do cartão e o dia do vencimento são obrigatórios!")
            elif novo_nome in cartoes_cadastrados:
                st.error("Este cartão já está cadastrado na sua base!")
            else:
                novo_registro = {"Cartão": novo_nome, "Venc": novo_venc}
                for m in lista_meses:
                    novo_registro[m] = 0.0
                db_faturas.append(novo_registro)
                salvar_tabela("faturas", db_faturas)
                st.success(f"Cartão {novo_nome} cadastrado com sucesso!")
                st.rerun()

st.divider()

# --- 3. MATRIZ CONSOLIDADA (AUDITORIA E LOTE) ---
st.subheader("📋 Matriz Consolidada")
with st.expander("Ver Planilha Completa (Edição em Lote)", expanded=False):
    st.markdown("Use esta tabela se precisar arrastar valores para vários meses de uma vez (ex: compras parceladas longas).")

    config = {
        "Cartão": st.column_config.TextColumn("💳 Cartão", disabled=True, width="medium"),
        "Venc": st.column_config.TextColumn("📅 Venc.", width="small")
    }

    for m in lista_meses:
        config[m] = st.column_config.NumberColumn(m, step=50.0, format="%.2f", width="small")

    # Recria o dataframe para garantir que pegou as atualizações do form de cima
    df_fat = pd.DataFrame(db_faturas)

    df_editado = st.data_editor(
        df_fat, 
        column_config=config,
        num_rows="dynamic", 
        use_container_width=True, 
        hide_index=True,
        key="ed_faturas"
    )

    if st.button("💾 Salvar Alterações na Matriz"):
        salvar_tabela("faturas", df_editado.to_dict(orient="records"))
        st.success("Matriz consolidada atualizada com sucesso no backend!")
        st.rerun()