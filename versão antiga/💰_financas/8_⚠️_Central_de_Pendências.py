import streamlit as st
import pandas as pd
import uuid
from data_manager import carregar_tabela, salvar_tabela, get_lista_meses

st.set_page_config(page_title="Pendências | Tesouraria", layout="wide")

st.title("⚠️ Central de Pendências e Atrasos")
st.markdown("Gerencie dívidas manuais e visualize tudo o que não foi 'checkado', comparando com o seu último snapshot.")

# --- CARREGAMENTO DE DADOS ---
db_caixa = carregar_tabela("caixa", [])
db_terceiros = carregar_tabela("terceiros", {"cobrancas": []})
db_execucao = carregar_tabela("execucao", {})
db_recorrentes = carregar_tabela("recorrentes", [])
db_pontuais = carregar_tabela("pontuais", [])
db_faturas = carregar_tabela("faturas", [])
db_dividas = carregar_tabela("dividas", []) # Nova base para dívidas manuais
lista_meses = get_lista_meses()

ultima_data = db_caixa[-1]['Data'] if db_caixa else "2000-01-01"
mes_ref = ultima_data[:7]

st.info(f"📅 Referência de Consolidação: **{ultima_data}**")

# ==========================================
# 1. CADASTRO MANUAL DE DÍVIDAS (FORMULÁRIO)
# ==========================================
with st.expander("➕ Cadastrar Nova Dívida Manual (Multas, Empréstimos, etc.)", expanded=False):
    with st.form("form_nova_divida", clear_on_submit=True):
        c1, c2, c3 = st.columns([3, 1, 1])
        desc_div = c1.text_input("Descrição da Dívida", placeholder="Ex: Multa de Trânsito - Placa ABC-123")
        val_div = c2.number_input("Valor da Parcela (R$)", min_value=0.0, step=50.0)
        qtd_parc = c3.number_input("Qtd. Parcelas", min_value=1, max_value=48, value=1)
        
        c4, c5, _ = st.columns([2, 1, 2])
        mes_ini = c4.selectbox("Mês de Início", lista_meses)
        dia_venc = c5.text_input("Dia de Vencimento", placeholder="10")
        
        if st.form_submit_button("Registrar Dívida", type="primary"):
            if not desc_div.strip() or val_div <= 0:
                st.error("Preencha a descrição e o valor corretamente.")
            else:
                # Lógica para gerar parcelas
                indice_inicio = lista_meses.index(mes_ini)
                for i in range(int(qtd_parc)):
                    if indice_inicio + i < len(lista_meses):
                        mes_parc = lista_meses[indice_inicio + i]
                        db_dividas.append({
                            "id": str(uuid.uuid4()),
                            "Descrição": f"{desc_div} ({i+1}/{int(qtd_parc)})",
                            "Valor": val_div,
                            "Mês": mes_parc,
                            "Dia": dia_venc,
                            "Pago": False
                        })
                salvar_tabela("dividas", db_dividas)
                st.success("Dívida registrada e parcelas geradas!")
                st.rerun()

st.divider()

# ==========================================
# 2. LÓGICA DE COLETA DE PENDÊNCIAS
# ==========================================
pendencias = []

# Adiciona as Dívidas Manuais (db_dividas)
for d in db_dividas:
    if not d.get("Pago", False):
        pendencias.append({
            "Mês": d["Mês"],
            "Tipo": "Dívida Manual",
            "Descrição": d["Descrição"],
            "Valor": d["Valor"],
            "Status": "Atrasado" if d["Mês"] < mes_ref else "Pendente",
            "id_original": d["id"],
            "db": "dividas"
        })

# Adiciona itens das outras abas (mesma lógica anterior)
for m in lista_meses:
    # Terceiros
    terc = [c for c in db_terceiros["cobrancas"] if c["Mês Alvo"] == m and not c['Recebido']]
    for c in terc:
        pendencias.append({"Mês": m, "Tipo": "Recebível (Terceiros)", "Descrição": f"{c['Pessoa']} - {c['Descrição']}", "Valor": c['Valor'], "Status": "Atrasado" if m < mes_ref else "Pendente", "id_original": c["id"], "db": "terceiros"})

    # Execução (Faturas, Recorrentes, Pontuais)
    checks = db_execucao.get(m, {})
    for f in db_faturas:
        val = float(f.get(m, 0.0))
        if val > 0 and not checks.get(f"fat_{f['Cartão']}", False):
            pendencias.append({"Mês": m, "Tipo": "Saída (Fatura)", "Descrição": f"Cartão {f['Cartão']}", "Valor": val, "Status": "Atrasado" if m < mes_ref else "Pendente", "id_original": f"fat_{f['Cartão']}", "db": "execucao"})
            
    for item in (db_recorrentes + db_pontuais):
        is_ativo = False
        if "Mês Alvo" in item and item["Mês Alvo"] == m: is_ativo = True
        if "Início" in item and item["Início"] <= m <= item.get("Fim", "2099-12"): is_ativo = True
        
        if is_ativo and not checks.get(str(item['id']), False):
            tipo = "Entrada" if item['Tipo'] == "Entrada" else "Saída"
            pendencias.append({"Mês": m, "Tipo": f"{tipo} (Fixo/Pontual)", "Descrição": item['Descrição'], "Valor": item['Valor'], "Status": "Atrasado" if m < mes_ref else "Pendente", "id_original": str(item['id']), "db": "execucao"})

# ==========================================
# 3. EXIBIÇÃO E GESTÃO
# ==========================================
if not pendencias:
    st.success("Nada pendente! Sua tesouraria está em dia.")
else:
    df_p = pd.DataFrame(pendencias)
    
    col1, col2 = st.columns(2)
    atrasados = df_p[df_p["Status"] == "Atrasado"]
    vincendos = df_p[df_p["Status"] == "Pendente"]
    
    with col1:
        st.subheader("🔴 Atrasados (Crítico)")
        st.dataframe(atrasados.drop(columns=["id_original", "db"]), use_container_width=True, hide_index=True)
        
    with col2:
        st.subheader("🟡 Vincendos (Futuro)")
        st.dataframe(vincendos.drop(columns=["id_original", "db"]), use_container_width=True, hide_index=True)

    st.divider()
    
    # 4. ÁREA DE BAIXA (MAGIA PARA NÃO POLUIR A EXECUÇÃO)
    st.subheader("✔️ Dar Baixa em Dívidas Manuais")
    st.markdown("Itens de terceiros ou execução devem ser baixados em suas respectivas abas. Abaixo, você gerencia apenas as **Dívidas Manuais** cadastradas nesta página.")
    
    dividas_pendentes = [d for d in db_dividas if not d.get("Pago", False)]
    if dividas_pendentes:
        df_div_edit = pd.DataFrame(dividas_pendentes)
        df_editado = st.data_editor(
            df_div_edit,
            column_config={
                "id": None,
                "Pago": st.column_config.CheckboxColumn("Pago?", default=False),
                "Mês": st.column_config.TextColumn("Mês", disabled=True),
                "Descrição": st.column_config.TextColumn("Descrição", disabled=True),
                "Valor": st.column_config.NumberColumn("Valor", format="R$ %.2f", disabled=True)
            },
            use_container_width=True,
            hide_index=True,
            key="ed_dividas_manuais"
        )
        
        if st.button("💾 Salvar Baixas de Dívidas", type="primary"):
            # Atualiza o db_dividas original com os valores marcados como pagos
            for _, row in df_editado.iterrows():
                if row["Pago"]:
                    for d in db_dividas:
                        if d["id"] == row["id"]:
                            d["Pago"] = True
            salvar_tabela("dividas", db_dividas)
            st.success("Baixas registradas!")
            st.rerun()
    else:
        st.caption("Nenhuma dívida manual pendente para baixar.")