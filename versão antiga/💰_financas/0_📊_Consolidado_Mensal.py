import streamlit as st
import pandas as pd
import calendar
from datetime import datetime
from data_manager import carregar_tabela, salvar_tabela, get_lista_meses

st.set_page_config(page_title="Execução | Tesouraria", layout="wide")

st.header("Painel de Execução e Fluxo Livre")

# --- CARREGAMENTO DE TODAS AS BASES ---
lista_meses_str = get_lista_meses()
db_caixa = carregar_tabela("caixa", [])
db_faturas = carregar_tabela("faturas", [])
db_recorrentes = carregar_tabela("recorrentes", [])
db_pontuais = carregar_tabela("pontuais", [])
db_execucao = carregar_tabela("execucao", {})
db_projecao = carregar_tabela("projecao_liquidez", []) # Base estática do motor de cálculo

# Puxa os orçamentos, investimentos e TERCEIROS
db_orcamento = carregar_tabela("orcamento", {"base": {}, "excecoes": []})
db_gastos = carregar_tabela("gastos", [])
db_plano_inv = carregar_tabela("plano_investimento", {"estrutural": {}, "tatico": []})
db_aportes = carregar_tabela("aportes_realizados", [])
db_terceiros = carregar_tabela("terceiros", {"pessoas": ["Roberta"], "cobrancas": []})

# --- ÂNCORA REAL (Calculada antecipadamente para o status do mês) ---
saldo_base = db_caixa[-1]['Total'] if db_caixa else 0.0
ultima_data_caixa = db_caixa[-1]['Data'] if db_caixa else "2000-01-01"
mes_ultimo_caixa = ultima_data_caixa[:7]

# Seleção do mês com caixa de aviso de status
col_mes, col_aviso = st.columns([1, 2])
mes_selecionado = col_mes.selectbox("📅 Selecione o Mês de Execução (Checklist):", lista_meses_str)

if mes_selecionado < mes_ultimo_caixa:
    estado_mes = "Passado"
    col_aviso.warning("Você está analisando dados de um mês anterior. Erros de preenchimento no passado, podem impactar nessa visualização.")
elif mes_selecionado > mes_ultimo_caixa:
    estado_mes = "Futuro"
    col_aviso.info("Você está visualizando projeções de um mês futuro.")
else:
    estado_mes = "Atual"
    col_aviso.success("Você está visualizando os dados do mês vigente.")

if mes_selecionado not in db_execucao:
    db_execucao[mes_selecionado] = {}
checks_mes = db_execucao[mes_selecionado]

# --- MOTOR DE FILTRAGEM DO MÊS SELECIONADO NA TELA ---
faturas_mes = [{"id": f"fat_{f['Cartão']}", "desc": f"Fatura {f['Cartão']} (Venc. {f.get('Venc', '')})", "valor": float(f.get(mes_selecionado, 0.0))} for f in db_faturas if float(f.get(mes_selecionado, 0.0)) > 0]
entradas_rec_mes = [r for r in db_recorrentes if r['Tipo'] == 'Entrada' and r['Início'] <= mes_selecionado <= r['Fim']]
saidas_rec_mes = [r for r in db_recorrentes if r['Tipo'] == 'Saída' and r['Início'] <= mes_selecionado <= r['Fim']]
entradas_pon_mes = [p for p in db_pontuais if p['Tipo'] == 'Entrada' and p['Mês Alvo'] == mes_selecionado]
saidas_pon_mes = [p for p in db_pontuais if p['Tipo'] == 'Saída' and p['Mês Alvo'] == mes_selecionado]
terceiros_mes = [c for c in db_terceiros["cobrancas"] if c["Mês Alvo"] == mes_selecionado]

todas_entradas = entradas_rec_mes + entradas_pon_mes
todas_saidas = saidas_rec_mes + saidas_pon_mes

st.divider()

# --- CHECKLIST DE EXECUÇÃO (Apenas Leitura/Gravação, Sem Recálculo) ---
col_in, col_out = st.columns(2)

e_pend_val = 0.0
with col_in:
    st.subheader("🟢 Entradas do Mês")
    if not (todas_entradas or terceiros_mes): st.caption("Sem entradas previstas.")
    
    for c in terceiros_mes:
        uid = str(c['id'])
        dia_previsto = f"[Dia {c.get('Dia', '')}] " if c.get('Dia') else ""
        label = f"🤝 {dia_previsto}{c['Pessoa']} - {c['Descrição']} - R$ {c['Valor']:,.2f}"
        
        c['Recebido'] = st.checkbox(label, value=c['Recebido'], key=f"chk_terc_{uid}")
        if not c['Recebido']:
            e_pend_val += c['Valor']

    for e in todas_entradas:
        uid = str(e['id'])
        estado_atual = checks_mes.get(uid, False)
        st_label = f"[Dia {e.get('Dia', '')}] {e['Descrição']} - R$ {e['Valor']:,.2f}"
        db_execucao[mes_selecionado][uid] = st.checkbox(st_label, value=estado_atual, key=f"chk_{mes_selecionado}_{uid}")
        if not db_execucao[mes_selecionado][uid]:
            e_pend_val += e['Valor']
            
    st.markdown(f"**A Receber Pendente Total:** :green[R$ {e_pend_val:,.2f}]")

s_pend_val = 0.0
with col_out:
    st.subheader("🔴 Saídas e Faturas")
    if not (faturas_mes or todas_saidas): st.caption("Sem saídas previstas.")
    
    for f in faturas_mes:
        uid = f['id']
        estado_atual = checks_mes.get(uid, False)
        db_execucao[mes_selecionado][uid] = st.checkbox(f"{f['desc']} - R$ {f['valor']:,.2f}", value=estado_atual, key=f"chk_{mes_selecionado}_{uid}")
        if not db_execucao[mes_selecionado][uid]:
            s_pend_val += f['valor']
            
    for s in todas_saidas:
        uid = str(s['id'])
        estado_atual = checks_mes.get(uid, False)
        st_label_sai = f"[Dia {s.get('Dia', '')}] {s['Descrição']} - R$ {s['Valor']:,.2f}"
        db_execucao[mes_selecionado][uid] = st.checkbox(st_label_sai, value=estado_atual, key=f"chk_{mes_selecionado}_{uid}")
        if not db_execucao[mes_selecionado][uid]:
            s_pend_val += s['Valor']
            
    st.markdown(f"**A Pagar Pendente:** :red[R$ {s_pend_val:,.2f}]")

st.markdown("<br>", unsafe_allow_html=True)
if st.button("💾 Salvar Status Mensal", type="primary"):
    salvar_tabela("execucao", db_execucao)
    salvar_tabela("terceiros", db_terceiros)
    st.success("Estado das obrigações e recebíveis atualizado! Lembre-se de recalcular a projeção abaixo.")

st.divider()

# --- INTEGRAÇÃO INTELIGENTE (ORÇAMENTO E INVESTIMENTOS) ---
def calc_teto_cv(mes):
    teto = sum(db_orcamento.get("base", {}).values())
    for exc in db_orcamento.get("excecoes", []):
        if exc["Mês Alvo"] == mes:
            teto = teto - db_orcamento["base"].get(exc["Categoria"], 0.0) + exc["Novo Teto"]
    return teto

def calc_meta_inv(mes):
    meta = sum(db_plano_inv.get("estrutural", {}).values())
    for tac in db_plano_inv.get("tatico", []):
        if tac["Mês Alvo"] == mes:
            meta += tac["Valor Extra"]
    return meta

st.header("Projeção de Liquidez (Cash Flow Waterfall)")

# ==========================================
# MOTOR DE CÁLCULO ESTÁTICO (BOTÃO DE GATILHO)
# ==========================================
if st.button("🔄 Recalcular Projeção e Atualizar Gráfico", type="primary", use_container_width=True):
    nova_projecao = []
    # O Ponto zero da projeção é sempre o mês do último snapshot registrado
    caixa_acumulado = saldo_base
    
    for m_str in lista_meses_str:
        if m_str < mes_ultimo_caixa:
            continue # Ignora o passado matemático
            
        # 1. Puxa A Receber e A Pagar Pendente (CORREÇÃO DO VAZAMENTO DE DADOS)
        e_m = sum(c['Valor'] for c in db_terceiros["cobrancas"] if c["Mês Alvo"] == m_str and not c.get('Recebido', False))
        
        entradas_rec_calc = [r for r in db_recorrentes if r.get('Tipo') == 'Entrada' and r.get('Início', m_str) <= m_str <= r.get('Fim', m_str)]
        entradas_pon_calc = [p for p in db_pontuais if p.get('Tipo') == 'Entrada' and p.get('Mês Alvo') == m_str]
        for e in (entradas_rec_calc + entradas_pon_calc):
            if not db_execucao.get(m_str, {}).get(str(e['id']), False): e_m += e['Valor']
        
        s_m = sum(float(f.get(m_str, 0.0)) for f in db_faturas if float(f.get(m_str, 0.0)) > 0 and not db_execucao.get(m_str, {}).get(f"fat_{f['Cartão']}", False))
        
        saidas_rec_calc = [r for r in db_recorrentes if r.get('Tipo') == 'Saída' and r.get('Início', m_str) <= m_str <= r.get('Fim', m_str)]
        saidas_pon_calc = [p for p in db_pontuais if p.get('Tipo') == 'Saída' and p.get('Mês Alvo') == m_str]
        for s in (saidas_rec_calc + saidas_pon_calc):
            if not db_execucao.get(m_str, {}).get(str(s['id']), False): s_m += s['Valor']
                
        # 2. Calcula as Sobras
        cv_pend_m = max(0, calc_teto_cv(m_str) - sum(g["Valor"] for g in db_gastos if g.get("Mês") == m_str))
        inv_pend_m = max(0, calc_meta_inv(m_str) - sum(a["Valor"] for a in db_aportes if a.get("Mês") == m_str))
        
        # 3. Matemática simples iterativa exigida
        fluxo_prov = e_m - s_m
        caixa_livre = caixa_acumulado + fluxo_prov - cv_pend_m - inv_pend_m
        
        nova_projecao.append({
            "Mês": m_str,
            "Saldo Inicial": caixa_acumulado,
            "e_m": e_m, # Salvo para transparência no tooltip
            "s_m": s_m, # Salvo para transparência no tooltip
            "Fluxo Prov.": fluxo_prov,
            "cv_pend_m": cv_pend_m,
            "inv_pend_m": inv_pend_m,
            "Caixa Livre Real": caixa_livre
        })
        
        # O Caixa Livre final deste mês vira o Saldo Inicial do mês seguinte
        caixa_acumulado = caixa_livre
        
    salvar_tabela("projecao_liquidez", nova_projecao)
    st.success("Cálculos atualizados e salvos na base de dados com sucesso!")
    st.rerun()

# ==========================================
# EXIBIÇÃO DE DADOS (APENAS LEITURA DA BASE)
# ==========================================
# Busca os dados pré-calculados estáticos do mês que está no seletor
dados_mes = next((p for p in db_projecao if p["Mês"] == mes_selecionado), None)

if dados_mes:
    saldo_ancora_display = dados_mes.get("Saldo Inicial", saldo_base)
    e_m_display = dados_mes.get("e_m", e_pend_val)
    s_m_display = dados_mes.get("s_m", s_pend_val)
    fluxo_prov_display = dados_mes.get("Fluxo Prov.", e_pend_val - s_pend_val)
    cv_pend_display = dados_mes.get("cv_pend_m", 0.0)
    inv_pend_display = dados_mes.get("inv_pend_m", 0.0)
    caixa_livre_display = dados_mes.get("Caixa Livre Real", dados_mes.get("Saldo Final", 0.0))
else:
    # Fallback seguro
    saldo_ancora_display = saldo_base
    e_m_display = e_pend_val
    s_m_display = s_pend_val
    fluxo_prov_display = e_pend_val - s_pend_val
    cv_pend_display = max(0, calc_teto_cv(mes_selecionado) - sum(g["Valor"] for g in db_gastos if g.get("Mês") == mes_selecionado))
    inv_pend_display = max(0, calc_meta_inv(mes_selecionado) - sum(a["Valor"] for a in db_aportes if a.get("Mês") == mes_selecionado))
    caixa_livre_display = saldo_base + fluxo_prov_display - cv_pend_display - inv_pend_display

# --- NOVA MÉTRICA: GASTO DIÁRIO MÁXIMO PERMITIDO ---
hoje = datetime.now()
mes_hoje_str = hoje.strftime("%Y-%m")

if mes_selecionado == mes_hoje_str:
    ultimo_dia = calendar.monthrange(hoje.year, hoje.month)[1]
    dias_restantes = ultimo_dia - hoje.day + 1
elif mes_selecionado > mes_hoje_str:
    ano_sel, mes_sel = map(int, mes_selecionado.split('-'))
    dias_restantes = calendar.monthrange(ano_sel, mes_sel)[1]
else:
    dias_restantes = 1 # Proteção contra divisão por zero em meses passados

# Verba antes de considerar as despesas variáveis (o que te fará fechar no zero a zero)
verba_disponivel = saldo_ancora_display + fluxo_prov_display - inv_pend_display
gasto_diario_max = verba_disponivel / dias_restantes if verba_disponivel > 0 else 0.0

# --- APRESENTAÇÃO DOS DADOS ---
c1, c2, c3, c4 = st.columns(4)
label_ancora = "Saldo Bancário Atual" if estado_mes == "Atual" else f"Saldo Inicial ({estado_mes})"

c1.metric(label_ancora, f"R$ {saldo_ancora_display:,.2f}", help=f"Data Âncora: {ultima_data_caixa}")
c2.metric("Fluxo de Caixa de Despesas Provisionadas", f"R$ {fluxo_prov_display:,.2f}", help=f"Entradas Pendentes (R$ {e_m_display:,.2f}) - Saídas/Faturas Pendentes (R$ {s_m_display:,.2f})")
c3.metric("Caixa Livre Real (Final do Mês)", f"R$ {caixa_livre_display:,.2f}", help=f"Saldo Inicial (R$ {saldo_ancora_display:,.2f}) + Fluxo Prov. (R$ {fluxo_prov_display:,.2f}) - Teto CV Pend. (R$ {cv_pend_display:,.2f}) - Meta Inv. Pend. (R$ {inv_pend_display:,.2f})")
c4.metric("Permitido Diário (Zero a Zero)", f"R$ {gasto_diario_max:,.2f}", help=f"Verba Disponível (R$ {verba_disponivel:,.2f}) / {dias_restantes} dias restantes")

with st.expander("🔍 Entenda o cálculo do Caixa Livre (Mês Selecionado)"):
    st.markdown(f"""
    O sistema puxa o **{label_ancora} (R$ {saldo_ancora_display:,.2f})** e soma com o Fluxo de Caixa de Despesas Provisionadas.
    
    Deduzidos automaticamente para segurança:
    * **R$ {cv_pend_display:,.2f}** (Sobra do Teto de Custo de Vida).
    * **R$ {inv_pend_display:,.2f}** (Sobra da Meta de Investimento).
    """)

st.subheader("Horizonte de Liquidez (Próximos 12 Meses)")

df_view = pd.DataFrame(db_projecao)
if not df_view.empty:
    if "Saldo Final" in df_view.columns and "Caixa Livre Real" not in df_view.columns:
        df_view.rename(columns={"Saldo Final": "Caixa Livre Real"}, inplace=True)
        
    st.bar_chart(df_view.set_index('Mês')['Caixa Livre Real'], color="#00cc66")

def color_negative_red(val):
    if isinstance(val, (int, float)):
        return f'color: {"#ff4b4b" if val < 0 else "#00cc66"}; font-weight: bold;'
    return ''

st.dataframe(
    df_view[["Mês", "Fluxo Prov.", "Caixa Livre Real"]].style.map(color_negative_red, subset=['Caixa Livre Real', 'Fluxo Prov.'])\
                   .format({"Fluxo Prov.": "R$ {:,.2f}", "Caixa Livre Real": "R$ {:,.2f}"}), 
    use_container_width=True, hide_index=True
)