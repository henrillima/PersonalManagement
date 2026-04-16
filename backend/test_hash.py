import bcrypt
import os
from dotenv import load_dotenv

load_dotenv()

senha = input("Digite sua senha: ").encode()
stored = os.environ.get("ADMIN_PASSWORD_HASH", "").encode()

print("Hash no .env:", stored.decode())
print("Resultado:", bcrypt.checkpw(senha, stored))
