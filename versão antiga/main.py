import streamlit as st

# O set_page_config deve ser sempre o primeiro comando do app no main.py
st.set_page_config(page_title="Life OS | Controle Total", layout="wide", page_icon="💸")

# --- 1. DECLARAÇÃO DAS PÁGINAS ---

# Início
p_home = st.Page("Home.py", title="Boas-vindas", icon="🏠", default=True)

# Módulo Financeiro (Mapeando a sua pasta 💰_financas exatamente como está)
p_consolidado = st.Page("💰_financas/0_📊_Consolidado_Mensal.py", title="Consolidado Mensal", icon="📊")
p_caixa = st.Page("💰_financas/1_🏦_Registro_Caixa_Atual.py", title="Registro de Caixa", icon="🏦")
p_faturas = st.Page("💰_financas/2_💳_Faturas_de_Cartão.py", title="Faturas de Cartão", icon="💳")
p_recorrentes = st.Page("💰_financas/3_🔁_Cadastro_Fluxos_Recorrentes.py", title="Fluxos Recorrentes", icon="🔁")
p_pontuais = st.Page("💰_financas/4_🎯_Cadastro_Fluxos_Pontuais.py", title="Fluxos Pontuais", icon="🎯")
p_custo_vida = st.Page("💰_financas/5_🛒_Acompanhamento_Custo_de_Vida_Variável.py", title="Custo de Vida Variável", icon="🛒")
p_investimentos = st.Page("💰_financas/6_📈_Controle_Fluxos_de_Investimentos.py", title="Fluxos de Investimentos", icon="📈")
p_terceiros = st.Page("💰_financas/7_🤝_Terceiros.py", title="Terceiros", icon="🤝")
p_pendencias = st.Page("💰_financas/8_⚠️_Central_de_Pendências.py", title="Central de Pendências", icon="⚠️")

# Módulo de Organização (Mapeando a sua pasta ⚙️_organizacao)
# Módulo de Organização (Mapeando a sua pasta ⚙️_organizacao)
p_tarefas_pessoais = st.Page("⚙️_organizacao/1_tarefas_pessoais.py", title="Tarefas Pessoais", icon="🏠")
p_tarefas_trabalho = st.Page("⚙️_organizacao/2_tarefas_trabalho.py", title="Tarefas de Trabalho", icon="💼")
p_calendario = st.Page("⚙️_organizacao/3_calendario.py", title="Calendário Geral", icon="📅")

# Módulo de Saúde (Mapeando a sua pasta 🍎_saude)
p_nutricao = st.Page("🍎_saude/nutricao.py", title="Controle de Dieta (IA)", icon="🥗")

# --- 2. AGRUPAMENTO E HIERARQUIA DO MENU LATERAL ---
pg = st.navigation(
    {
        "🏠 Início": [p_home],
        "💰 Módulo Financeiro": [
            p_consolidado,
            p_caixa,
            p_faturas,
            p_recorrentes,
            p_pontuais,
            p_custo_vida,
            p_investimentos,
            p_terceiros,
            p_pendencias
        ],
        "⚙️ Organização e Rotina": [p_tarefas_pessoais, p_tarefas_trabalho, p_calendario],
        "🍎 Saúde e Corpo": [p_nutricao]
    }
)

# Executa a navegação
pg.run()