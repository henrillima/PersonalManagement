import json
import os
from datetime import datetime

DATA_DIR = "data"
if not os.path.exists(DATA_DIR):
    os.makedirs(DATA_DIR)

# Lista global de categorias para padronizar o DRE Pessoal
CATEGORIAS_PADRAO = [
    "Moradia", "Transporte & Gasolina", "Alimentação (Mercado)", 
    "Alimentação (Ifood/Restaurante)", "Lazer & Rolê", "Saúde", 
    "Educação & Trabalho", "Vídeogame & Assinaturas", "Compras Gerais", "Família", "Outros"
]

def get_lista_meses():
    meses_futuros = [(datetime.now().year + (datetime.now().month + i - 1) // 12, 
                     (datetime.now().month + i - 1) % 12 + 1) for i in range(12)]
    return [f"{ano}-{mes:02d}" for ano, mes in meses_futuros]

def carregar_tabela(nome_arquivo, estrutura_padrao):
    caminho = os.path.join(DATA_DIR, f"{nome_arquivo}.json")
    if os.path.exists(caminho):
        if os.path.getsize(caminho) == 0:
            return estrutura_padrao
        try:
            with open(caminho, 'r', encoding='utf-8') as f:
                return json.load(f)
        except json.JSONDecodeError:
            return estrutura_padrao
    return estrutura_padrao

def salvar_tabela(nome_arquivo, dados):
    caminho = os.path.join(DATA_DIR, f"{nome_arquivo}.json")
    with open(caminho, 'w', encoding='utf-8') as f:
        json.dump(dados, f, indent=4)