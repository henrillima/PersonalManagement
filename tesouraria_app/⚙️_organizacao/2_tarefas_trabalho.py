import streamlit as st
import pandas as pd
import uuid
import requests
from datetime import datetime, timedelta
from data_manager import carregar_tabela, salvar_tabela

st.set_page_config(page_title="Tarefas de Trabalho | Life OS", layout="wide")

st.title("💼 Gestão de Tarefas de Trabalho")
st.markdown("Controle do seu backlog privado e sincronização bidirecional com as planilhas da MadCap.")

# --- PADRONIZAÇÕES GLOBAIS DA MADCAP ---
LISTA_STATUS = ["Não iniciada", "Em execução", "Bloqueada", "Concluída"]
LISTA_ASSUNTO = ["Backoffice", "Marketing", "Gestão", "Captação", "Novos Negócios", "Operação"]
LISTA_PRIORITY = [1, 2, 3]
LISTA_PHASE = ["Routine", "Foundation", "Expansion"]
LISTA_REPORT = ["Sim", "Não"]

# --- CARREGAMENTO DO BANCO DE DADOS LOCAL ---
db_tarefas = carregar_tabela("tarefas_trabalho", [])
db_frentes = carregar_tabela("frentes_trabalho", ["G11 Agronegócios", "Estruturação de FIDCs", "Análise de Portfólio", "Reuniões", "Outros"])
db_planilhas = carregar_tabela("planilhas_trabalho", {}) 

# ==========================================
# 1. GESTÃO DE FRENTES (BACKLOG PRIVADO)
# ==========================================
with st.expander("⚙️ Gerenciar Frentes de Trabalho", expanded=False):
    c_add, c_rem = st.columns(2)
    with c_add:
        st.markdown("**Adicionar Nova Frente**")
        nova_frente = st.text_input("Nova Frente/Projeto", key="input_nova_frente_trab")
        if st.button("➕ Adicionar", type="primary", key="btn_add_frente_trab"):
            if nova_frente and nova_frente not in db_frentes:
                db_frentes.append(nova_frente)
                salvar_tabela("frentes_trabalho", db_frentes)
                st.success(f"Frente '{nova_frente}' criada!")
                st.rerun()
            elif nova_frente in db_frentes:
                st.warning("Essa frente já existe.")
                
    with c_rem:
        st.markdown("**Remover Frente Existente**")
        frente_remover = st.selectbox("Remover frente", db_frentes, key="sel_rem_frente_trab")
        if st.button("🗑️ Remover", key="btn_rem_frente_trab"):
            if frente_remover in db_frentes:
                db_frentes.remove(frente_remover)
                salvar_tabela("frentes_trabalho", db_frentes)
                st.success(f"Frente '{frente_remover}' removida!")
                st.rerun()

# ==========================================
# 2. CADASTRO LOCAL
# ==========================================
with st.expander("➕ Cadastrar Tarefa (Privada)", expanded=False):
    with st.form("form_nova_tarefa_trab", clear_on_submit=True):
        c1, c2, c3 = st.columns([2, 1, 1])
        titulo = c1.text_input("Ação necessária")
        frente = c2.selectbox("Frente", db_frentes)
        prioridade = c3.selectbox("Prioridade", ["Alta 🔥", "Média ⚡", "Baixa 🧊"], index=1)
        
        c4, c5 = st.columns([1, 3])
        data_limite = c4.date_input("Deadline", value=datetime.today())
        observacao = c5.text_input("Observações / Links do Drive")
        
        if st.form_submit_button("Adicionar Tarefa", type="primary"):
            if titulo.strip():
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
                salvar_tabela("tarefas_trabalho", db_tarefas)
                st.success("Tarefa registrada no backlog local!")
                st.rerun()
            else:
                st.error("A tarefa precisa ter um título!")

st.divider()

# ==========================================
# 3. FILTROS E CONSOLIDADOS (BACKLOG PRIVADO)
# ==========================================
st.subheader("🕵️ Meu Backlog Operacional")

hoje = datetime.today()
inicio_semana = hoje - timedelta(days=hoje.weekday())
fim_semana = inicio_semana + timedelta(days=6)

col_f_tempo, col_f_frente, col_metricas1, col_metricas2 = st.columns([2, 1.5, 1, 1])

filtro_tempo = col_f_tempo.radio("Período:", ["Esta Semana", "Atrasadas", "Todas as Pendentes"], horizontal=True, key="rad_tempo_trab")
filtro_frente = col_f_frente.selectbox("Frente:", ["Todas"] + db_frentes, key="sel_frente_trab")

tarefas_view = []
for t in db_tarefas:
    if t.get("concluida"): continue
    if filtro_frente != "Todas" and t["frente"] != filtro_frente: continue
        
    data_t = datetime.strptime(t["data_limite"], "%Y-%m-%d")
    if filtro_tempo == "Esta Semana" and (inicio_semana.date() <= data_t.date() <= fim_semana.date()): tarefas_view.append(t)
    elif filtro_tempo == "Atrasadas" and data_t.date() < hoje.date(): tarefas_view.append(t)
    elif filtro_tempo == "Todas as Pendentes": tarefas_view.append(t)

pendentes_total = len([t for t in db_tarefas if not t.get("concluida")])
atrasadas_total = len([t for t in db_tarefas if not t.get("concluida") and datetime.strptime(t["data_limite"], "%Y-%m-%d").date() < hoje.date()])

col_metricas1.metric("Pendências Totais", pendentes_total)
col_metricas2.metric("Atrasadas", atrasadas_total, delta="- Atenção" if atrasadas_total > 0 else "Tudo em dia!", delta_color="inverse")

# ==========================================
# 4. VISUALIZAÇÃO POR FRENTES (KANBAN PRIVADO)
# ==========================================
if not tarefas_view:
    st.info("Backlog local limpo para estes filtros. Bom trabalho!")
else:
    frentes_ativas = sorted(list(set([t["frente"] for t in tarefas_view])))
    for frente in frentes_ativas:
        st.markdown(f"**📂 {frente}**")
        tarefas_frente = sorted([t for t in tarefas_view if t["frente"] == frente], key=lambda x: x["data_limite"])
        
        for t in tarefas_frente:
            col_check, col_info, col_data = st.columns([0.5, 3, 1])
            if col_check.checkbox(" ", key=f"chkt_{t['id']}"):
                for db_t in db_tarefas:
                    if db_t["id"] == t["id"]: db_t["concluida"] = True
                salvar_tabela("tarefas_trabalho", db_tarefas)
                st.toast(f"✅ Tarefa '{t['titulo']}' concluída!")
                st.rerun()
                
            cor_prio = "🔥" if "Alta" in t["prioridade"] else "⚡" if "Média" in t["prioridade"] else "🧊"
            data_obj = datetime.strptime(t["data_limite"], "%Y-%m-%d").date()
            alerta = " 🔴 *(Atrasada)*" if data_obj < hoje.date() else ""
            
            col_info.markdown(f"**{t['titulo']}** {cor_prio}")
            if t.get("observacao"):
                col_info.caption(f"↳ *{t['observacao']}*")
                
            col_data.markdown(f"📅 {data_obj.strftime('%d/%m/%Y')} {alerta}")
        st.write("---")

# ==========================================
# 5. AUDITORIA DE CONCLUÍDAS (LOCAL)
# ==========================================
with st.expander("✅ Ver Tarefas Locais Concluídas Recentemente"):
    concluidas = [t for t in db_tarefas if t.get("concluida")]
    if concluidas:
        df_c = pd.DataFrame(concluidas)
        st.dataframe(df_c[["frente", "titulo", "data_limite"]], use_container_width=True, hide_index=True)
        
        if st.button("🗑️ Limpar Histórico de Concluídas", key="btn_limpar_trab"):
            db_tarefas = [t for t in db_tarefas if not t.get("concluida")]
            salvar_tabela("tarefas_trabalho", db_tarefas)
            st.rerun()
    else:
        st.caption("Nenhuma tarefa concluída ainda.")

st.divider()

# ==========================================
# 6. INTEGRAÇÃO MADCAP (MÚLTIPLAS PLANILHAS)
# ==========================================
st.subheader("🔗 Sincronização de Planilhas MadCap (Team Report)")

with st.expander("⚙️ Cadastrar ou Remover Planilhas do Drive", expanded=False):
    c_add_pl, c_rem_pl = st.columns(2)
    with c_add_pl:
        st.markdown("**Integrar Nova Planilha**")
        nome_planilha = st.text_input("Nome de Identificação (Ex: FIDC G11)")
        url_planilha = st.text_input("URL do Apps Script")
        if st.button("➕ Salvar Integração", type="primary"):
            if nome_planilha and url_planilha:
                db_planilhas[nome_planilha] = url_planilha
                salvar_tabela("planilhas_trabalho", db_planilhas)
                st.success(f"Planilha '{nome_planilha}' vinculada!")
                st.rerun()
                
    with c_rem_pl:
        st.markdown("**Remover Integração**")
        if db_planilhas:
            planilha_remover = st.selectbox("Selecione para desconectar", list(db_planilhas.keys()))
            if st.button("🗑️ Remover Planilha"):
                del db_planilhas[planilha_remover]
                salvar_tabela("planilhas_trabalho", db_planilhas)
                st.success("Conexão removida!")
                st.rerun()

# --- ÁREA OPERACIONAL DO DRIVE ---
if db_planilhas:
    col_sel, col_btn_pull = st.columns([3, 1])
    planilha_alvo = col_sel.selectbox("Selecione o Projeto/Planilha:", list(db_planilhas.keys()))
    url_alvo = db_planilhas[planilha_alvo]

    # GATILHO 1: PUXAR DA NUVEM (GET)
    if col_btn_pull.button("⬇️ Puxar Tarefas do Drive", use_container_width=True):
        with st.spinner(f"Lendo dados de '{planilha_alvo}'..."):
            try:
                response = requests.get(url_alvo)
                if response.status_code == 200:
                    st.session_state['tarefas_sheet'] = response.json()
                    st.session_state['planilha_ativa_url'] = url_alvo
                    st.session_state['planilha_ativa_nome'] = planilha_alvo
                    st.success(f"Sincronizado! {len(st.session_state['tarefas_sheet'])} tarefas encontradas.")
                else:
                    st.error("Erro ao acessar a planilha. Verifique a URL.")
            except Exception as e:
                st.error(f"Falha na conexão: {e}")

    # Exibição segura (só exibe se o dropdown não tiver sido trocado)
    if 'tarefas_sheet' in st.session_state and st.session_state.get('planilha_ativa_nome') == planilha_alvo:
        st.markdown("---")
        
        # --- CRIAR NOVA TAREFA NA PLANILHA ---
        with st.expander(f"➕ Criar Nova Tarefa Direto no Drive ({planilha_alvo})"):
            with st.form("form_sheet_append", clear_on_submit=True):
                st.caption("Esta ação criará uma nova linha na planilha do Google Sheets sem alterar as existentes.")
                cs1, cs2, cs3 = st.columns([2, 1, 1])
                new_task = cs1.text_input("Task (Nome da Tarefa)")
                new_assunto = cs2.selectbox("Assunto", LISTA_ASSUNTO)
                new_status = cs3.selectbox("Status Inicial", LISTA_STATUS, index=0)
                
                cs4, cs5, cs6, cs7 = st.columns(4)
                new_priority = cs4.selectbox("Priority", LISTA_PRIORITY, index=2)
                new_phase = cs5.selectbox("Phase", LISTA_PHASE)
                new_report = cs6.selectbox("Deve Entrar no Report?", LISTA_REPORT)
                new_due_date = cs7.date_input("Due Date")
                
                new_obs = st.text_input("Observações")
                
                # GATILHO 2: ENVIAR PARA A NUVEM (POST - APPEND)
                if st.form_submit_button("⬆️ Subir Nova Tarefa para o Drive", type="primary"):
                    if not new_task:
                        st.error("Preencha o nome da tarefa.")
                    else:
                        payload_append = {
                            "action": "append",
                            "task": new_task,
                            "status": new_status,
                            "assunto": new_assunto,
                            "owner": "Henri Leonardo",
                            "priority": new_priority,
                            "phase": new_phase,
                            "due_date": new_due_date.strftime("%d/%m/%Y"),
                            "obs": new_obs,
                            "report": new_report
                        }
                        with st.spinner("Gravando nova linha no Sheets..."):
                            requests.post(st.session_state['planilha_ativa_url'], json=payload_append)
                        st.success("Tarefa criada com sucesso! Clique em 'Puxar Tarefas do Drive' para atualizar a lista abaixo.")

        # --- LISTAGEM E EDIÇÃO DE TAREFAS EXISTENTES ---
        st.markdown("### Suas Tarefas Em Aberto")
        for i, ts in enumerate(st.session_state['tarefas_sheet']):
            if ts.get("status") != "Concluída":
                
                info_prio = f"[Prioridade: {ts.get('priority', '-')}]"
                info_prazo = f" | Prazo: {ts.get('due_date', '-')}" if ts.get('due_date') else ""
                titulo_expander = f"📂 [{ts.get('assunto', 'Geral')}] {ts.get('task', 'Sem título')} {info_prio}{info_prazo}"
                
                with st.expander(titulo_expander, expanded=False):
                    col_status, col_obs = st.columns([1, 2])
                    
                    status_atual = ts.get("status", "Não iniciada")
                    index_status = LISTA_STATUS.index(status_atual) if status_atual in LISTA_STATUS else 0
                    
                    novo_status = col_status.selectbox("Status", LISTA_STATUS, index=index_status, key=f"status_sheet_{i}")
                    nova_obs = col_obs.text_input("Observações", value=ts.get("obs", ""), key=f"obs_sheet_{i}")
                    
                    # GATILHO 3: ATUALIZAR NA NUVEM (POST - UPDATE)
                    if st.button("💾 Salvar Alteração no Drive", key=f"btn_sync_sheet_{i}"):
                        data_hoje = datetime.today().strftime("%d/%m/%Y") if novo_status == "Concluída" else ""
                        
                        payload_update = {
                            "action": "update",
                            "linha": ts["linha"],
                            "novo_status": novo_status,
                            "nova_obs": nova_obs,
                            "data_conclusao": data_hoje
                        }
                        
                        with st.spinner("Atualizando célula específica..."):
                            requests.post(st.session_state['planilha_ativa_url'], json=payload_update)
                            
                        st.toast("Planilha sincronizada!")
                        
                        # Atualiza localmente para reatividade visual
                        if novo_status == "Concluída":
                            st.session_state['tarefas_sheet'][i]["status"] = "Concluída"
                        else:
                            st.session_state['tarefas_sheet'][i]["status"] = novo_status
                            st.session_state['tarefas_sheet'][i]["obs"] = nova_obs
                            
                        st.rerun()
else:
    st.info("Nenhuma planilha integrada. Expanda o menu de configurações acima para conectar seu primeiro projeto!")