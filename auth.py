import streamlit as st

def verificar_senha():
    """Retorna True se o usuário estiver autenticado."""
    if "autenticado" not in st.session_state:
        st.session_state["autenticado"] = False

    if not st.session_state["autenticado"]:
        st.title("🔒 Life OS Restrito")
        senha_digitada = st.text_input("Digite a senha de acesso", type="password")
        
        if st.button("Entrar", type="primary"):
            # O ideal no deploy é usar st.secrets["SENHA_MEU_APP"]
            if senha_digitada == "ita_finance_2026": # Substitua pela sua senha forte
                st.session_state["autenticado"] = True
                st.rerun()
            else:
                st.error("Acesso negado.")
        
        # O st.stop() é a mágica: ele impede que qualquer código abaixo rode se não tiver logado
        st.stop()