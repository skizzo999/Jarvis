from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import os

# Carica variabili d'ambiente da .env
load_dotenv(dotenv_path="/home/matteo/Jarvis/api/.env")

from routers import transactions, events
from routers.server_router  import router as server_router
from routers.storage_router import router as storage_router
from routers.command_router import router as command_router
from routers.fitness_router import router as fitness_router

app = FastAPI(title="Jarvis API", version="2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(transactions.router)
app.include_router(events.router)
app.include_router(server_router)
app.include_router(storage_router)
app.include_router(command_router)
app.include_router(fitness_router)

@app.get("/")
def root():
    return {"status": "ok", "version": "2.0"}
