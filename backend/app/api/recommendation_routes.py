import logging
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.schemas.recommendation_schema import RecommendationResponse, MultiRecommendationRequest, MultiRecommendationResponse
from app.services.recommendation_service import RecommendationService

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/recommendations", tags=["Recommendations"])

@router.get("/{product_name}", response_model=RecommendationResponse)
def get_recommendations(product_name: str, limit: int = Query(10, ge=1, le=50), db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    recs = RecommendationService.recommend(db, [product_name], limit)
    logger.info("Recommendation request user=%s product=%s count=%s", user.id, product_name, len(recs))
    return {"product": product_name, "recommendations": recs}

@router.post("", response_model=MultiRecommendationResponse)
def multi_recommendations(data: MultiRecommendationRequest, limit: int = Query(10, ge=1, le=50), db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    recs = RecommendationService.recommend(db, data.items, limit)
    logger.info("Multi-recommendation user=%s items=%s count=%s", user.id, data.items, len(recs))
    return {"input_items": data.items, "recommendations": recs}
