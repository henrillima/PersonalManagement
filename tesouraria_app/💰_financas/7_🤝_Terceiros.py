import streamlit as st
import pandas as pd
import uuid
from data_manager import carregar_tabela, salvar_tabela, get_lista_meses

st.set_page_config(page_title="Terceiros | Tesouraria", layout="wide")

st.title("🤝 Gestão de Terceiros (Empréstimos)")
st.markdown("Controle o dinheiro emprestado no PIX ou o uso dos seus cartões por outras pessoas. **Os dados aqui não alteram suas faturas originais**, servem apenas para você auditar quem te deve e quando cobrar.")

lista_meses = get_lista_meses()

# --- CARREGAMENTO DE DADOS (READ-ONLY PARA FATURAS) ---
db_faturas = carregar_tabela("faturas", [])
# Dicionário rápido para puxar o dia de vencimento atrelado a cada cartão
cartoes_cadastrados = {fat["Cartão"]: fat.get("Venc", "10") for fat in db_faturas} if db_faturas else {"Nenhum Cartão Cadastrado": "01"}

# O Banco de Dados local desta página
db_terceiros = carregar_tabela("terceiros", {"pessoas": ["Roberta"], "cobrancas": []})

# ==========================================
# 1. SETUP DE PESSOAS
# ==========================================
with st.expander("👥 Gerenciar Contatos (Devedores)", expanded=False):
    col_lista, col_add = st.columns(2)
    
    with col_lista:
        st.write("**Pessoas Cadastradas:**")
        for p in db_terceiros["pessoas"]:
            st.markdown(f"- {p}")
            
    with col_add:
        with st.form("form_nova_pessoa", clear_on_submit=True):
            nova_pessoa = st.text_input("Adicionar Nova Pessoa", placeholder="Nome do amigo/familiar")
            if st.form_submit_button("Cadastrar"):
                if nova_pessoa.strip() and nova_pessoa not in db_terceiros["pessoas"]:
                    db_terceiros["pessoas"].append(nova_pessoa.strip())
                    salvar_tabela("terceiros", db_terceiros)
                    st.success(f"{nova_pessoa} adicionado(a)!")
                    st.rerun()

st.divider()

# ==========================================
# 2. LANÇAMENTO DE EMPRÉSTIMOS
# ==========================================
st.subheader("🚀 Registrar Novo Empréstimo")
tipo_emp = st.radio("Origem do Recurso:", ["💳 Cartão de Crédito (Parcelado)", "💸 Dinheiro / PIX / Débito"], horizontal=True)

with st.form("form_emprestimo", clear_on_submit=True):
    c1, c2 = st.columns([1, 2])
    pessoa_sel = c1.selectbox("Quem pegou?", db_terceiros["pessoas"])
    desc_nova = c2.text_input("Descrição do Gasto", placeholder="Ex: Supermercado, Remédios, Geladeira Nova")
    
    st.markdown("---")
    
    if tipo_emp == "💳 Cartão de Crédito (Parcelado)":
        c3, c4, c5 = st.columns([2, 1, 3])
        cartao_sel = c3.selectbox("Qual Cartão foi usado?", list(cartoes_cadastrados.keys()))
        val_parcela = c4.number_input("Valor da Parcela (R$)", min_value=0.0, step=50.0, format="%.2f")
        meses_sel = c5.multiselect("Em quais meses será cobrado?", lista_meses, help="Selecione todos os meses em que essa parcela vai cair na sua fatura.")
        
    else:
        c3, c4, c5 = st.columns([2, 1, 1])
        mes_alvo = c3.selectbox("Mês Previsto para Devolução", lista_meses)
        val_total = c4.number_input("Valor Total Emprestado (R$)", min_value=0.0, step=50.0, format="%.2f")
        dia_dev = c5.text_input("Dia Combinado", placeholder="Ex: 05")

    submit_emp = st.form_submit_button("Registrar Dívida", type="primary")
    
    if submit_emp:
        if not desc_nova.strip():
            st.error("A descrição é obrigatória!")
        else:
            if tipo_emp == "💳 Cartão de Crédito (Parcelado)":
                if not meses_sel or val_parcela == 0:
                    st.error("Selecione os meses e o valor da parcela!")
                else:
                    dia_venc = cartoes_cadastrados.get(cartao_sel, "10")
                    # Cria um registro independente para cada mês da parcela (estilo "Pontuais")
                    for m in meses_sel:
                        db_terceiros["cobrancas"].append({
                            "id": str(uuid.uuid4()), "Pessoa": pessoa_sel, 
                            "Origem": f"💳 {cartao_sel}", "Descrição": desc_nova, 
                            "Mês Alvo": m, "Dia": dia_venc, "Valor": val_parcela, "Recebido": False
                        })
                    salvar_tabela("terceiros", db_terceiros)
                    st.success(f"Parcelamento de {pessoa_sel} registrado com sucesso!")
                    st.rerun()
            else:
                if val_total == 0:
                    st.error("O valor não pode ser zero!")
                else:
                    db_terceiros["cobrancas"].append({
                        "id": str(uuid.uuid4()), "Pessoa": pessoa_sel, 
                        "Origem": "💸 Dinheiro/PIX", "Descrição": desc_nova, 
                        "Mês Alvo": mes_alvo, "Dia": dia_dev, "Valor": val_total, "Recebido": False
                    })
                    salvar_tabela("terceiros", db_terceiros)
                    st.success(f"Empréstimo para {pessoa_sel} registrado com sucesso!")
                    st.rerun()

st.divider()

# ==========================================
# 3. CONSOLIDADO E COBRANÇAS
# ==========================================
st.subheader("📋 Painel de Recebíveis")

# Filtro Temporal
opcoes_filtro = ["Todos os Meses"] + lista_meses
col_filtro, _ = st.columns([1, 2])
mes_filtro = col_filtro.selectbox("Filtre a cobrança pelo mês:", opcoes_filtro, index=1)

# Constrói o Dataframe
df_cobrancas = pd.DataFrame(db_terceiros["cobrancas"]) if db_terceiros["cobrancas"] else pd.DataFrame(columns=["id", "Pessoa", "Origem", "Descrição", "Mês Alvo", "Dia", "Valor", "Recebido"])

# Aplica o Filtro
if mes_filtro == "Todos os Meses":
    df_view = df_cobrancas.copy()
else:
    df_view = df_cobrancas[df_cobrancas["Mês Alvo"] == mes_filtro].copy()

# Métricas
total_esperado = df_view["Valor"].sum() if not df_view.empty else 0.0
total_recebido = df_view[df_view["Recebido"] == True]["Valor"].sum() if not df_view.empty else 0.0
falta_receber = total_esperado - total_recebido

c1, c2, c3 = st.columns(3)
titulo_metrica = "no Mês" if mes_filtro != "Todos os Meses" else "Totais"
c1.metric(f"Total Esperado ({titulo_metrica})", f"R$ {total_esperado:,.2f}")
c2.metric(f"Já Recebido", f"R$ {total_recebido:,.2f}")
c3.metric(f"Falta Receber", f"R$ {falta_receber:,.2f}")

st.markdown("<br>", unsafe_allow_html=True)

# Tabela de Edição / Check de Pagamento
if not df_view.empty:
    st.markdown("*(Marque a caixa na coluna **Recebido** quando te pagarem. Você também pode corrigir valores abaixo)*")
    
    config = {
        "id": None,
        "Pessoa": st.column_config.SelectboxColumn("Devedor", options=db_terceiros["pessoas"], width="medium"),
        "Origem": st.column_config.TextColumn("Origem", width="medium"),
        "Descrição": st.column_config.TextColumn("Descrição", width="large"),
        "Mês Alvo": st.column_config.SelectboxColumn("Mês", options=lista_meses, width="small"),
        "Dia": st.column_config.TextColumn("Dia", width="small"),
        "Valor": st.column_config.NumberColumn("Valor (R$)", step=50.0, format="%.2f", width="small"),
        "Recebido": st.column_config.CheckboxColumn("✅ Recebido?", width="small")
    }

    df_editado = st.data_editor(
        df_view, 
        column_config=config, 
        num_rows="dynamic", 
        use_container_width=True, 
        hide_index=True,
        key="ed_cobrancas"
    )

    if st.button("💾 Salvar Status de Recebimentos", type="primary"):
        ids_na_view = df_view["id"].tolist()
        db_restante = [c for c in db_terceiros["cobrancas"] if c["id"] not in ids_na_view]
        
        regs_editados = df_editado.to_dict(orient="records")
        for r in regs_editados:
            if pd.isna(r.get("id")) or str(r.get("id")).strip() == "": 
                r["id"] = str(uuid.uuid4())
                
        db_terceiros["cobrancas"] = db_restante + regs_editados
        salvar_tabela("terceiros", db_terceiros)
        st.success("Tabela de recebíveis atualizada!")
        st.rerun()
else:
    st.info("Não há cobranças pendentes ou registradas para este filtro.")