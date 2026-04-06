import streamlit as st
import pandas as pd
import uuid
from datetime import datetime, timedelta
from data_manager import carregar_tabela, salvar_tabela

st.set_page_config(page_title="Tarefas Pessoais | Life OS", layout="wide")

st.title("🏠 Gestão de Tarefas Pessoais")
st.markdown("Controle de pendências do dia a dia, organização e rotina acadêmica.")

# --- CARREGAMENTO DO BANCO DE DADOS ---
db_tarefas = carregar_tabela("tarefas_pessoais", [])
# Nova tabela para guardar as frentes de forma dinâmica
db_frentes = carregar_tabela("frentes_pessoais", ["ITA", "Organização", "Problemas do Dia a Dia", "Clube dos Cinco", "Outros"])

# ==========================================
# 1. GESTÃO DE FRENTES DE ATUAÇÃO
# ==========================================
with st.expander("⚙️ Gerenciar Frentes de Atuação (Projetos)", expanded=False):
    c_add, c_rem = st.columns(2)
    with c_add:
        st.markdown("**Adicionar Nova Frente**")
        nova_frente = st.text_input("Nome do Novo Projeto/Frente", key="input_nova_frente")
        if st.button("➕ Adicionar", type="primary"):
            if nova_frente and nova_frente not in db_frentes:
                db_frentes.append(nova_frente)
                salvar_tabela("frentes_pessoais", db_frentes)
                st.success(f"Frente '{nova_frente}' criada com sucesso!")
                st.rerun()
            elif nova_frente in db_frentes:
                st.warning("Essa frente já existe.")
    
    with c_rem:
        st.markdown("**Remover Frente Existente**")
        frente_remover = st.selectbox("Selecione a frente para excluir", db_frentes, key="sel_rem_frente")
        if st.button("🗑️ Remover"):
            if frente_remover in db_frentes:
                db_frentes.remove(frente_remover)
                salvar_tabela("frentes_pessoais", db_frentes)
                st.success(f"Frente '{frente_remover}' removida!")
                st.rerun()

# ==========================================
# 2. FORMULÁRIO DE CADASTRO DE TAREFAS
# ==========================================
with st.expander("➕ Cadastrar Nova Tarefa Pessoal", expanded=False):
    with st.form("form_nova_tarefa", clear_on_submit=True):
        c1, c2, c3 = st.columns([2, 1, 1])
        
        titulo = c1.text_input("O que precisa ser feito?", placeholder="Ex: Renovar matrícula, Comprar presente...")
        
        # Puxa dinamicamente as frentes cadastradas
        frente = c2.selectbox("Frente de Atuação", db_frentes)
        
        prioridade = c3.selectbox("Prioridade", ["Alta 🔥", "Média ⚡", "Baixa 🧊"], index=1)
        
        c4, c5 = st.columns([1, 3])
        data_limite = c4.date_input("Data Limite", value=datetime.today())
        observacao = c5.text_input("Observações (Opcional)", placeholder="Links, detalhes ou informações extras...")
        
        if st.form_submit_button("Adicionar Tarefa", type="primary"):
            if not titulo.strip():
                st.error("A tarefa precisa ter um título!")
            else:
                db_tarefas.append({
                    "id": str(uuid.uuid4()),
                    "titulo": titulo,
                    "frente": frente,
                    "prioridade": prioridade,
                    "data_limite": data_limite.strftime("%Y-%m-%d"),
                    "observacao": observacao,
                    "concluida": False,
                    "data_criacao": datetime.today().strftime("%Y-%m-%d")
                })
                salvar_tabela("tarefas_pessoais", db_tarefas)
                st.success("Tarefa adicionada com sucesso!")
                st.rerun()

st.divider()

# ==========================================
# 3. FILTROS E CONSOLIDADOS
# ==========================================
hoje = datetime.today()
inicio_semana = hoje - timedelta(days=hoje.weekday()) # Segunda-feira
fim_semana = inicio_semana + timedelta(days=6)        # Domingo

# Ajuste nas colunas para comportar o novo filtro de frentes
col_filtro_tempo, col_filtro_frente, col_metricas1, col_metricas2 = st.columns([2, 1.5, 1, 1])

filtro_tempo = col_filtro_tempo.radio(
    "Filtrar por Período:", 
    ["Esta Semana", "Atrasadas", "Todas as Pendentes"], 
    horizontal=True
)

opcoes_filtro_frente = ["Todas"] + db_frentes
filtro_frente = col_filtro_frente.selectbox("Filtrar por Frente:", opcoes_filtro_frente)

# Lógica de Filtragem da visualização
tarefas_view = []
for t in db_tarefas:
    if t["concluida"]:
        continue # O painel principal mostra apenas pendentes
        
    # Applica o Filtro de Frente antes da data
    if filtro_frente != "Todas" and t["frente"] != filtro_frente:
        continue
        
    data_t = datetime.strptime(t["data_limite"], "%Y-%m-%d")
    
    if filtro_tempo == "Esta Semana" and (inicio_semana.date() <= data_t.date() <= fim_semana.date()):
        tarefas_view.append(t)
    elif filtro_tempo == "Atrasadas" and data_t.date() < hoje.date():
        tarefas_view.append(t)
    elif filtro_tempo == "Todas as Pendentes":
        tarefas_view.append(t)

pendentes_total = len([t for t in db_tarefas if not t["concluida"]])
atrasadas_total = len([t for t in db_tarefas if not t["concluida"] and datetime.strptime(t["data_limite"], "%Y-%m-%d").date() < hoje.date()])

col_metricas1.metric("Pendências Totais", pendentes_total)
col_metricas2.metric("Atrasadas", atrasadas_total, delta="- Atenção" if atrasadas_total > 0 else "Tudo em dia!", delta_color="inverse")

# ==========================================
# 4. VISUALIZAÇÃO POR FRENTES (KANBAN VERTICAL)
# ==========================================
if not tarefas_view:
    st.info("Nenhuma tarefa encontrada para estes filtros. Vá aproveitar o dia!")
else:
    # Agrupa as tarefas filtradas por Frente
    frentes_ativas = list(set([t["frente"] for t in tarefas_view]))
    frentes_ativas.sort()
    
    for frente in frentes_ativas:
        st.subheader(f"📂 {frente}")
        
        tarefas_frente = [t for t in tarefas_view if t["frente"] == frente]
        # Ordena por data limite
        tarefas_frente.sort(key=lambda x: x["data_limite"])
        
        for t in tarefas_frente:
            col_check, col_info, col_data = st.columns([0.5, 3, 1])
            
            # Checkbox para dar baixa
            concluida = col_check.checkbox(" ", key=f"chk_{t['id']}")
            
            # Formatação visual baseada na prioridade e data
            cor_prio = "🔥" if "Alta" in t["prioridade"] else "⚡" if "Média" in t["prioridade"] else "🧊"
            data_obj = datetime.strptime(t["data_limite"], "%Y-%m-%d").date()
            alerta_atraso = " 🔴 *(Atrasada)*" if data_obj < hoje.date() else ""
            
            col_info.markdown(f"**{t['titulo']}** {cor_prio}")
            if t["observacao"]:
                col_info.caption(f"↳ *{t['observacao']}*")
                
            col_data.markdown(f"📅 {data_obj.strftime('%d/%m/%Y')} {alerta_atraso}")
            
            # Ação de Conclusão (se o usuário clicar no check)
            if concluida:
                for db_t in db_tarefas:
                    if db_t["id"] == t["id"]:
                        db_t["concluida"] = True
                salvar_tabela("tarefas_pessoais", db_tarefas)
                st.toast(f"✅ Tarefa '{t['titulo']}' concluída!")
                st.rerun()
        st.write("---")

# ==========================================
# 5. AUDITORIA DE CONCLUÍDAS
# ==========================================
with st.expander("✅ Ver Tarefas Concluídas Recentemente"):
    concluidas = [t for t in db_tarefas if t["concluida"]]
    if concluidas:
        df_c = pd.DataFrame(concluidas)
        st.dataframe(df_c[["frente", "titulo", "data_limite"]], use_container_width=True, hide_index=True)
        
        if st.button("🗑️ Limpar Histórico de Concluídas"):
            db_tarefas = [t for t in db_tarefas if not t["concluida"]]
            salvar_tabela("tarefas_pessoais", db_tarefas)
            st.rerun()
    else:
        st.caption("Nenhuma tarefa concluída ainda.")