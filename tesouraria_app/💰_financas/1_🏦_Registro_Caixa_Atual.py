import streamlit as st
import pandas as pd
from datetime import datetime
from data_manager import carregar_tabela, salvar_tabela

st.set_page_config(page_title="Caixa | Tesouraria", layout="wide")

# --- CARREGAMENTO DE DADOS ---
db_caixa = carregar_tabela("caixa", [])
# Lista de bancos permitidos (configurável)
bancos_config = carregar_tabela("bancos_config", ["XP", "Nubank", "Inter", "Santander"])

st.header("Registro de Posição de Caixa")
st.markdown("Atualize o saldo disponível em cada uma de suas contas para gravar o snapshot de hoje.")

# ==========================================
# 1. GESTÃO DE CONTAS (ADICIONAR/REMOVER)
# ==========================================
with st.expander("⚙️ Gerenciar Contas Bancárias / Corretoras", expanded=False):
    col_add, col_rem = st.columns(2)
    
    with col_add:
        st.subheader("Adicionar Conta")
        novo_banco = st.text_input("Nome da Nova Conta", placeholder="Ex: BTG, Binance, Itaú")
        if st.button("➕ Adicionar"):
            if novo_banco.strip() and novo_banco not in bancos_config:
                bancos_config.append(novo_banco.strip())
                salvar_tabela("bancos_config", bancos_config)
                st.success(f"Conta '{novo_banco}' adicionada!")
                st.rerun()
            else:
                st.error("Nome inválido ou conta já existente.")

    with col_rem:
        st.subheader("Remover Conta")
        banco_para_remover = st.selectbox("Selecione para remover", [""] + bancos_config)
        if st.button("❌ Remover", type="secondary"):
            if banco_para_remover and banco_para_remover in bancos_config:
                bancos_config.remove(banco_para_remover)
                salvar_tabela("bancos_config", bancos_config)
                st.warning(f"Conta '{banco_para_remover}' removida da interface.")
                st.rerun()

st.divider()

# ==========================================
# 2. INPUT DINÂMICO DE SALDOS
# ==========================================
st.subheader("💰 Saldo Atual")
hoje_str = datetime.now().strftime("%Y-%m-%d")

# Cria colunas dinamicamente baseado na lista de bancos
if not bancos_config:
    st.info("Nenhuma conta cadastrada. Use o menu acima para adicionar.")
else:
    # Organiza em colunas de no máximo 4 por linha para não poluir
    cols = st.columns(len(bancos_config))
    saldos_input = {}
    
    for i, banco in enumerate(bancos_config):
        saldos_input[banco] = cols[i].number_input(f"{banco} (R$)", step=100.0, key=f"inp_{banco}")

    total_hoje = sum(saldos_input.values())
    
    st.markdown(f"### Total Consolidado: :green[R$ {total_hoje:,.2f}]")

    if st.button("📸 Gravar Snapshot de Hoje", type="primary", use_container_width=True):
        # Cria o registro do snapshot
        novo_snapshot = {"Data": hoje_str}
        novo_snapshot.update(saldos_input) # Adiciona cada banco como uma chave
        novo_snapshot["Total"] = total_hoje
        
        db_caixa.append(novo_snapshot)
        salvar_tabela("caixa", db_caixa)
        st.success(f"Snapshot de {hoje_str} gravado com sucesso!")
        st.rerun()

st.divider()

# ==========================================
# 3. HISTÓRICO E GRÁFICO
# ==========================================
if db_caixa:
    st.subheader("📈 Evolução do Patrimônio Líquido")
    
    # Criamos o DataFrame e preenchemos NaNs com 0 
    # (importante caso você adicione um banco hoje que não existia no snapshot de ontem)
    df = pd.DataFrame(db_caixa).set_index("Data").fillna(0)
    
    # Gráfico de Área ou Linha
    st.area_chart(df["Total"], color="#00cc66")
    
    st.subheader("📑 Tabela de Dados Históricos")
    # Formatação para moeda
    st.dataframe(df.style.format("R$ {:,.2f}"), use_container_width=True)