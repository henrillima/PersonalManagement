import streamlit as st
import pandas as pd
import requests
from datetime import datetime, timedelta
from streamlit_calendar import calendar
from data_manager import carregar_tabela, salvar_tabela

st.set_page_config(page_title="Calendário Life OS", layout="wide")
# --- CSS PARA TOOLTIPS E ESTILIZAÇÃO ---
st.markdown("""
    <style>
    .fc-event:hover {
        cursor: pointer;
        filter: brightness(0.9);
    }
    .fc-timegrid-now-indicator-line {
        border-color: #ff4b4b !important;
        border-width: 2px !important;
    }
    .fc-timegrid-now-indicator-arrow {
        border-color: #ff4b4b !important;
        color: #ff4b4b !important;
    }
    </style>
""", unsafe_allow_html=True) # <-- CORRIGIDO AQUI

st.title("📅 Calendário e Backlog Consolidado")

URL_AGENDA = "https://script.google.com/macros/s/AKfycbyIHrxmcpAFfsHl0tDoc9gUAIoovfKOVZOxFU6wogd37_rRUw1IxxPYrxqBYe6zBpo/exec"

# --- CARREGAMENTO DE DADOS ---
db_tarefas_pessoais = carregar_tabela("tarefas_pessoais", [])
db_tarefas_trabalho = carregar_tabela("tarefas_trabalho", [])

# ==========================================
# 1. BUSCA DE EVENTOS E AJUSTE DE HOVER
# ==========================================
eventos_agenda = []
try:
    resp = requests.get(URL_AGENDA)
    if resp.status_code == 200:
        raw_events = resp.json()
        for ev in raw_events:
            eventos_agenda.append({
                "id": ev.get("id"),
                "title": ev.get("title"),
                "start": ev.get("start"),
                "end": ev.get("end"),
                "description": ev.get("description"),
                "color": "#3D5AFE",
                "display": "block",
                # O 'extendedProps' permite passar dados extras para o componente
                "extendedProps": {"description": ev.get("description")}
            })
except Exception as e:
    st.error(f"Erro na Agenda: {e}")

# ==========================================
# 2. CONFIGURAÇÕES DO CALENDÁRIO (UI INTERATIVA)
# ==========================================
st.subheader("🗓️ Visão da Semana")

calendar_options = {
    "headerToolbar": {
        "left": "today prev,next",
        "center": "title",
        "right": "dayGridMonth,timeGridWeek,timeGridDay",
    },
    "initialView": "timeGridWeek",
    "slotMinTime": "06:00:00",
    "slotMaxTime": "23:00:00",
    "selectable": True,
    "nowIndicator": True,  # A BARRINHA VERMELHA DO TEMPO ATUAL
    "allDaySlot": False,
    "editable": False,
    "locale": "pt-br",
    "eventTimeFormat": {"hour": "2-digit", "minute": "2-digit", "meridiem": False}
}

# Renderiza o componente
state = calendar(events=eventos_agenda, options=calendar_options, key="google_calendar")

# --- LÓGICA DE CORREÇÃO DE FUSO E CLIQUES ---
data_pre = datetime.now()

# CORREÇÃO DO BUG DE HORÁRIO:
# O FullCalendar envia a data em UTC. Subtraímos 3 horas para o horário de Brasília.
if state.get("callback") == "dateClick":
    data_utc = datetime.fromisoformat(state["dateClick"]["date"].replace("Z", ""))
    data_pre = data_utc - timedelta(hours=3)
    st.info(f"📍 Agendando para: **{data_pre.strftime('%d/%m/%Y às %H:%M')}**")

# TOOLTIP / DETALHES AO CLICAR
if state.get("callback") == "eventClick":
    evento_clicado = state["eventClick"]["event"]
    with st.chat_message("assistant"):
        st.write(f"**Evento:** {evento_clicado['title']}")
        if "description" in evento_clicado.get("extendedProps", {}):
            st.write(f"ℹ️ {evento_clicado['extendedProps']['description']}")

# ==========================================
# 3. FORMULÁRIO DE INVITE
# ==========================================
with st.expander("➕ Novo Compromisso / Invite", expanded=(state.get("callback") == "dateClick")):
    with st.form("form_novo_evento", clear_on_submit=True):
        c1, c2 = st.columns([2, 2])
        titulo_evento = c1.text_input("Título")
        convidados = c2.text_input("Convidados (e-mails separados por vírgula)")
        
        desc_evento = st.text_input("Descrição / Link")
        
        c3, c4, c5, c6 = st.columns(4)
        d_ini = c3.date_input("Início", value=data_pre.date())
        h_ini = c4.time_input("Hora Início", value=data_pre.time())
        d_fim = c5.date_input("Fim", value=data_pre.date())
        h_fim = c6.time_input("Hora Fim", value=(data_pre + timedelta(hours=1)).time())
        
        if st.form_submit_button("🚀 Sincronizar com Google", type="primary"):
            if titulo_evento:
                start_iso = f"{d_ini}T{h_ini.strftime('%H:%M:%S')}"
                end_iso = f"{d_fim}T{h_fim.strftime('%H:%M:%S')}"
                requests.post(URL_AGENDA, json={
                    "title": titulo_evento, "description": desc_evento,
                    "start": start_iso, "end": end_iso, "guests": convidados
                })
                st.success("Sincronizado!")
                st.rerun()

st.divider()

# ==========================================
# 4. CONSOLIDADOR DE TAREFAS (COM CHECKBOX)
# ==========================================
st.subheader("🎯 Backlog Unificado")

# Coleta de tarefas (Filtro por data de hoje para ser mais produtivo)
tarefas_hoje = []
hoje_str = datetime.now().strftime("%Y-%m-%d")

# Processamento de tarefas pessoais e trabalho
for db, origem in [(db_tarefas_pessoais, "Pessoal 🏠"), (db_tarefas_trabalho, "Trabalho 💼")]:
    for t in db:
        if not t.get("concluida"):
            t["origem_label"] = origem
            t["banco"] = "tarefas_pessoais" if "Pessoal" in origem else "tarefas_trabalho"
            tarefas_hoje.append(t)

# Adiciona da planilha se estiver na sessão
if 'tarefas_sheet' in st.session_state:
    for ts in st.session_state['tarefas_sheet']:
        if ts.get("status") != "Concluída":
            tarefas_hoje.append({
                "id": str(ts.get("linha")), "titulo": ts.get("task"),
                "frente": ts.get("assunto"), "data_limite": ts.get("due_date"),
                "origem_label": "Planilha 🔗", "banco": "sheet_externa"
            })

# Ordenação
def sort_key(x):
    d = x.get("data_limite", "9999-99-99")
    return d.replace("/", "-")

tarefas_hoje.sort(key=sort_key)

if tarefas_hoje:
    for t in tarefas_hoje:
        col_check, col_txt = st.columns([0.1, 0.9])
        if t["banco"] != "sheet_externa":
            if col_check.checkbox("", key=f"c_{t['id']}_{t['banco']}"):
                db_alvo = db_tarefas_pessoais if t["banco"] == "tarefas_pessoais" else db_tarefas_trabalho
                for i in db_alvo:
                    if i["id"] == t["id"]: i["concluida"] = True
                salvar_tabela(t["banco"], db_alvo)
                st.rerun()
        else:
            col_check.markdown("🔗")
            
        # Alerta visual para tarefas do dia ou atrasadas
        prazo = t.get("data_limite", "")
        alerta = "⚠️" if prazo == hoje_str else "🚨" if prazo < hoje_str else ""
        
        col_txt.markdown(f"**{t['titulo']}** {alerta}  \n"
                        f"<small>{t['origem_label']} | {t['frente']} | Prazo: {prazo}</small>", 
                        unsafe_allow_html=True) # <-- CORRIGIDO AQUI
        st.divider()