from fastapi import APIRouter

from app.services.runtime_singleton import orchestrator

router = APIRouter(tags=['health'])


@router.get('/health')
def health():
    return {'ok': True, 'ws': orchestrator.ws.health()}
