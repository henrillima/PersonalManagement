import streamlit as st
import pandas as pd
import uuid
import json
import re
from datetime import datetime, timedelta
from openai import OpenAI
from data_manager import carregar_tabela, salvar_tabela

st.set_page_config(page_title="Saúde e Nutrição | Life OS", layout="wide")

st.title("🥗 Saúde, Nutrição e Corpo")
st.markdown("Controle metabólico, acompanhamento de peso e diário alimentar inteligente guiado por IA.")

# --- CARREGAMENTO DE BANCOS DE DADOS ---
db_perfil = carregar_tabela("saude_perfil", {})
db_peso = carregar_tabela("saude_peso", [])
db_dieta = carregar_tabela("saude_dieta", [])
db_treino = carregar_tabela("saude_treino", [])

# ==========================================
# 0. CONFIGURAÇÕES E MOTOR IA (OPENAI)
# ==========================================
with st.expander("⚙️ Perfil Biológico e API OpenAI", expanded=not bool(db_perfil)):
    c1, c2, c3, c4 = st.columns(4)
    idade = c1.number_input("Idade", min_value=10, max_value=120, value=db_perfil.get("idade", 25))
    altura = c2.number_input("Altura (cm)", min_value=100, max_value=250, value=db_perfil.get("altura", 175))
    sexo = c3.selectbox("Sexo Biológico", ["Masculino", "Feminino"], index=0 if db_perfil.get("sexo", "Masculino") == "Masculino" else 1)
    fator_ativ = c4.selectbox("Fator Ativ. Diária (NEAT)", 
                              ["Sedentário (1.2)", "Leve (1.375)", "Moderado (1.55)", "Intenso (1.725)"], 
                              index=db_perfil.get("fator_idx", 0))
    
    api_key = st.text_input("OpenAI API Key (sk-...)", value=db_perfil.get("api_key", ""), type="password", help="Gere sua chave na plataforma da OpenAI (platform.openai.com)")
    
    if st.button("💾 Salvar Perfil"):
        db_perfil.update({
            "idade": idade, "altura": altura, "sexo": sexo, 
            "fator_idx": ["Sedentário (1.2)", "Leve (1.375)", "Moderado (1.55)", "Intenso (1.725)"].index(fator_ativ),
            "fator_mult": float(re.search(r'\((.*?)\)', fator_ativ).group(1)),
            "api_key": api_key
        })
        salvar_tabela("saude_perfil", db_perfil)
        st.success("Perfil atualizado!")
        st.rerun()

# Configuração do Cliente OpenAI
client = None
if db_perfil.get("api_key"):
    try:
        client = OpenAI(api_key=db_perfil["api_key"])
    except Exception as e:
        st.error(f"Erro ao carregar a chave da OpenAI: {e}")
else:
    st.warning("⚠️ Configure sua API Key da OpenAI no painel acima para usar o reconhecimento automático.")

# Identifica o último peso para cálculos dinâmicos
ultimo_peso = db_peso[-1]["peso"] if db_peso else 70.0

# ==========================================
# 1. FORMULÁRIOS DE REGISTRO (PESO, DIETA E TREINO)
# ==========================================
st.subheader("📝 Diário de Registros")

tab_peso, tab_dieta, tab_treino = st.tabs(["⚖️ Registrar Peso", "🍽️ Registrar Refeição (IA)", "🏃 Registrar Treino (IA)"])

with tab_peso:
    with st.form("form_peso", clear_on_submit=True):
        c1, c2 = st.columns([1, 2])
        data_peso = c1.date_input("Data da Pesagem", value=datetime.today())
        novo_peso = c2.number_input("Peso (kg)", min_value=30.0, max_value=200.0, value=float(ultimo_peso), step=0.1)
        if st.form_submit_button("Salvar Peso", type="primary"):
            db_peso.append({"id": str(uuid.uuid4()), "data": data_peso.strftime("%Y-%m-%d"), "peso": novo_peso})
            db_peso.sort(key=lambda x: x["data"])
            salvar_tabela("saude_peso", db_peso)
            st.toast("Peso registrado com sucesso!")
            st.rerun()

with tab_dieta:
    with st.form("form_dieta", clear_on_submit=True):
        c_data, c_ref = st.columns([1, 2])
        data_dieta = c_data.date_input("Data do Consumo", value=datetime.today(), key="data_dieta")
        refeicao = c_ref.selectbox("Refeição", ["Café da manhã", "Almoço", "Jantar", "Lanche da tarde", "Lanche da noite/madrugada", "Pré-treino", "Pós-treino"])
        
        descricao_dieta = st.text_area("O que você comeu?", placeholder="Ex: 150g de patinho moído, 100g de arroz branco e 1 concha de feijão.")
        
        if st.form_submit_button("🧠 Analisar Macros com IA e Salvar", type="primary"):
            if not client:
                st.error("API Key não configurada.")
            elif descricao_dieta.strip():
                with st.spinner("A OpenAI está calculando seus macronutrientes..."):
                    try:
                        prompt_sistema = "Você é um nutricionista calculista. Retorne APENAS um objeto JSON com as chaves inteiras: 'calorias', 'proteina', 'carboidrato', 'gordura'."
                        prompt_usuario = f"Estime os valores nutricionais da seguinte refeição: '{descricao_dieta}'."
                        
                        resposta = client.chat.completions.create(
                            model="gpt-4o-mini",
                            response_format={"type": "json_object"},
                            messages=[
                                {"role": "system", "content": prompt_sistema},
                                {"role": "user", "content": prompt_usuario}
                            ]
                        )
                        
                        dados_nutri = json.loads(resposta.choices[0].message.content)
                        
                        db_dieta.append({
                            "id": str(uuid.uuid4()),
                            "data": data_dieta.strftime("%Y-%m-%d"),
                            "refeicao": refeicao,
                            "descricao": descricao_dieta,
                            "calorias": dados_nutri.get("calorias", 0),
                            "proteina": dados_nutri.get("proteina", 0),
                            "carboidrato": dados_nutri.get("carboidrato", 0),
                            "gordura": dados_nutri.get("gordura", 0)
                        })
                        salvar_tabela("saude_dieta", db_dieta)
                        st.success(f"Registrado: {dados_nutri.get('calorias', 0)} kcal adicionadas ao {refeicao}!")
                        st.rerun()
                    except Exception as e:
                        st.error(f"Erro na comunicação com a OpenAI: {e}")
            else:
                st.warning("Descreva o que você comeu.")

with tab_treino:
    with st.form("form_treino", clear_on_submit=True):
        c_data_t, c_dummy = st.columns([1, 2])
        data_treino = c_data_t.date_input("Data do Treino", value=datetime.today(), key="data_treino")
        descricao_treino = st.text_area("O que você treinou?", placeholder="Ex: Musculação intensa (costas e bíceps) por 1 hora, mais 20 min de esteira a 8km/h.")
        
        if st.form_submit_button("🧠 Estimar Gasto Calórico e Salvar", type="primary"):
            if not client:
                st.error("API Key não configurada.")
            elif descricao_treino.strip():
                with st.spinner("Calculando gasto energético..."):
                    try:
                        prompt_sistema = "Você é um fisiologista esportivo. Retorne APENAS um objeto JSON contendo a chave inteira 'gasto_calorico'."
                        prompt_usuario = f"Estime o gasto calórico ativo do seguinte treino feito por um homem de {ultimo_peso}kg: '{descricao_treino}'."
                        
                        resposta = client.chat.completions.create(
                            model="gpt-4o-mini",
                            response_format={"type": "json_object"},
                            messages=[
                                {"role": "system", "content": prompt_sistema},
                                {"role": "user", "content": prompt_usuario}
                            ]
                        )
                        
                        dados_treino = json.loads(resposta.choices[0].message.content)
                        
                        db_treino.append({
                            "id": str(uuid.uuid4()),
                            "data": data_treino.strftime("%Y-%m-%d"),
                            "descricao": descricao_treino,
                            "gasto_calorico": dados_treino.get("gasto_calorico", 0)
                        })
                        salvar_tabela("saude_treino", db_treino)
                        st.success(f"Treino salvo! Estimativa de {dados_treino.get('gasto_calorico', 0)} kcal queimadas.")
                        st.rerun()
                    except Exception as e:
                        st.error(f"Erro na comunicação com a OpenAI: {e}")
            else:
                st.warning("Descreva o seu treino.")

st.divider()

# ==========================================
# 2. MOTOR MATEMÁTICO E CÁLCULO DE METAS
# ==========================================
hoje_str = datetime.today().strftime("%Y-%m-%d")

idade_u = db_perfil.get("idade", 25)
altura_u = db_perfil.get("altura", 175)
fator_m = db_perfil.get("fator_mult", 1.2)

if db_perfil.get("sexo", "Masculino") == "Masculino":
    tmb = (10 * ultimo_peso) + (6.25 * altura_u) - (5 * idade_u) + 5
else:
    tmb = (10 * ultimo_peso) + (6.25 * altura_u) - (5 * idade_u) - 161

gasto_diario_base = tmb * fator_m

# --- CÁLCULO DINÂMICO DE METAS (Recomposição Corporal) ---
meta_kcal = gasto_diario_base - 300 # Déficit calórico leve e seguro
meta_prot = ultimo_peso * 2.0       # 2g de proteína por kg de peso
meta_gord = ultimo_peso * 0.8       # 0.8g de gordura por kg de peso
# O carboidrato preenche as calorias restantes: (1g Prot = 4kcal | 1g Gord = 9kcal | 1g Carb = 4kcal)
calorias_restantes = meta_kcal - (meta_prot * 4) - (meta_gord * 9)
meta_carb = max(calorias_restantes / 4, 0)

# --- CONSOLIDAÇÃO DO DIA ---
df_dieta = pd.DataFrame(db_dieta)
df_treino = pd.DataFrame(db_treino)

calorias_hoje = df_dieta[df_dieta["data"] == hoje_str]["calorias"].sum() if not df_dieta.empty else 0
prot_hoje = df_dieta[df_dieta["data"] == hoje_str]["proteina"].sum() if not df_dieta.empty else 0
carb_hoje = df_dieta[df_dieta["data"] == hoje_str]["carboidrato"].sum() if not df_dieta.empty else 0
gord_hoje = df_dieta[df_dieta["data"] == hoje_str]["gordura"].sum() if not df_dieta.empty else 0

treino_hoje = df_treino[df_treino["data"] == hoje_str]["gasto_calorico"].sum() if not df_treino.empty else 0
gasto_total_hoje = gasto_diario_base + treino_hoje
saldo_calorico_hoje = calorias_hoje - gasto_total_hoje

# ==========================================
# 3. DASHBOARD DE MÉTRICAS (VISÃO HOJE)
# ==========================================
st.subheader(f"📊 Resumo Metabólico do Dia ({datetime.today().strftime('%d/%m/%Y')})")

col_m1, col_m2, col_m3, col_m4 = st.columns(4)
col_m1.metric("⚖️ Peso Atual", f"{ultimo_peso:.1f} kg", help="Último peso registrado.")
col_m2.metric("🔥 Gasto Energético (TMB + Treino)", f"{gasto_total_hoje:.0f} kcal", help=f"TMB Estimada: {tmb:.0f} kcal/dia")
col_m3.metric("🍔 Consumo Calórico", f"{calorias_hoje:.0f} kcal", help=f"Meta ideal diária: ~{meta_kcal:.0f} kcal")

if saldo_calorico_hoje > 0:
    delta_str = f"+{saldo_calorico_hoje:.0f} (Superávit)"
    delta_cor = "normal" if saldo_calorico_hoje <= 300 else "inverse" 
else:
    delta_str = f"{saldo_calorico_hoje:.0f} (Déficit)"
    delta_cor = "normal"
    
col_m4.metric("⚖️ Saldo Calórico Real", f"{abs(saldo_calorico_hoje):.0f} kcal", delta=delta_str, delta_color=delta_cor)

# --- BARRAS DE PROGRESSO COM ALERTA ---
st.markdown(f"**Metas de Macronutrientes (Baseadas no seu peso atual de {ultimo_peso}kg):**")
cm1, cm2, cm3 = st.columns(3)

def renderizar_macro(col, nome, icone, consumido, meta):
    pct = consumido / meta if meta > 0 else 0
    col.progress(min(pct, 1.0))
    if pct <= 1.0:
        col.caption(f"{icone} {nome}: **{consumido:.0f}g / {meta:.0f}g** ({pct*100:.0f}%)")
    else:
        # Fica vermelho se estourar a meta
        col.error(f"{icone} {nome}: **{consumido:.0f}g / {meta:.0f}g** ⚠️ Estourou {consumido - meta:.0f}g")

renderizar_macro(cm1, "Proteínas", "🥩", prot_hoje, meta_prot)
renderizar_macro(cm2, "Carboidratos", "🍚", carb_hoje, meta_carb)
renderizar_macro(cm3, "Gorduras", "🥑", gord_hoje, meta_gord)

# --- HISTÓRICO DO DIA ---
with st.expander(f"📖 Ver registros inseridos em {hoje_str}"):
    st.markdown("**🍽️ Alimentação**")
    hoje_dieta = [d for d in db_dieta if d["data"] == hoje_str]
    if hoje_dieta:
        for d in hoje_dieta:
            col_txt, col_del = st.columns([10, 1])
            col_txt.markdown(f"**{d['refeicao']}**: {d['descricao']} *(🔥 {d.get('calorias', 0)} kcal | 🥩 {d.get('proteina', 0)}g P | 🍚 {d.get('carboidrato', 0)}g C | 🥑 {d.get('gordura', 0)}g G)*")
            if col_del.button("🗑️", key=f"del_d_{d['id']}"):
                db_dieta.remove(d)
                salvar_tabela("saude_dieta", db_dieta)
                st.rerun()
    else:
        st.caption("Nenhum alimento registrado hoje ainda.")
        
    st.markdown("---")
    
    st.markdown("**🏃 Atividades Físicas**")
    hoje_treino = [t for t in db_treino if t["data"] == hoje_str]
    if hoje_treino:
        for t in hoje_treino:
            col_txt_t, col_del_t = st.columns([10, 1])
            col_txt_t.markdown(f"**Treino**: {t['descricao']} *(🔥 Queimou aprox. {t.get('gasto_calorico', 0)} kcal)*")
            if col_del_t.button("🗑️", key=f"del_t_{t['id']}"):
                db_treino.remove(t)
                salvar_tabela("saude_treino", db_treino)
                st.rerun()
    else:
        st.caption("Nenhuma atividade física registrada hoje.")

st.divider()

# ==========================================
# 4. GRÁFICOS HISTÓRICOS (DADOS REAIS)
# ==========================================
st.subheader("📈 Acompanhamento Histórico")

if db_peso or db_dieta or db_treino:
    cg1, cg2 = st.columns(2)
    
    with cg1:
        st.markdown("**Evolução de Peso (kg)**")
        if db_peso:
            df_p_plot = pd.DataFrame(db_peso).sort_values("data")
            st.line_chart(df_p_plot.set_index("data")["peso"], color="#ff4b4b")
        else:
            st.caption("Ainda não há dados de peso registrados.")
            
    with cg2:
        st.markdown("**Consumo Calórico Diário (kcal)**")
        if db_dieta:
            df_d_plot = pd.DataFrame(db_dieta).groupby("data")["calorias"].sum().reset_index()
            st.bar_chart(df_d_plot.set_index("data")["calorias"], color="#3D5AFE")
        else:
            st.caption("Ainda não há refeições registradas.")
            
    cg3, cg4 = st.columns(2)
    
    with cg3:
        st.markdown("**Distribuição de Macronutrientes (g)**")
        if db_dieta:
            df_macros_plot = pd.DataFrame(db_dieta).groupby("data")[["proteina", "carboidrato", "gordura"]].sum().reset_index()
            st.area_chart(df_macros_plot.set_index("data"), color=["#ff4b4b", "#3D5AFE", "#00cc66"])
        else:
            st.caption("Ainda não há dados de macronutrientes.")
            
    with cg4:
        st.markdown("**Gasto Calórico em Treinos (kcal)**")
        if db_treino:
            df_t_plot = pd.DataFrame(db_treino).groupby("data")["gasto_calorico"].sum().reset_index()
            st.bar_chart(df_t_plot.set_index("data")["gasto_calorico"], color="#ff9900")
        else:
            st.caption("Ainda não há treinos registrados.")

else:
    st.info("Registre alguns dados nos formulários acima para começar a ver seus gráficos de acompanhamento.")