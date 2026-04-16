import os
from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers import auth_router, home_router, tarefas_router, financeiro_router, saude_router
from routers import lista_compras_router

app = FastAPI(title="Life OS API", version="1.0.0")

# ── CORS ────────────────────────────────────────────────────────────────────────
raw_origins = os.environ.get("ALLOWED_ORIGINS", "http://localhost:5173")
origins = [o.strip() for o in raw_origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ──────────────────────────────────────────────────────────────────────
app.include_router(auth_router.router,       prefix="/api/v1")
app.include_router(home_router.router,       prefix="/api/v1")
app.include_router(tarefas_router.router,    prefix="/api/v1")
app.include_router(financeiro_router.router, prefix="/api/v1")
app.include_router(saude_router.router,        prefix="/api/v1")
app.include_router(lista_compras_router.router, prefix="/api/v1")


@app.get("/api/v1/health")
def health():
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
