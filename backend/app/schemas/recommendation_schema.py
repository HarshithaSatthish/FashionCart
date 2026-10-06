from pydantic import BaseModel, Field


class Recommendation(BaseModel):
    product: str
    confidence: float
    lift: float
    support: float


class RecommendationResponse(BaseModel):
    product: str
    recommendations: list[Recommendation]


class MultiRecommendationRequest(BaseModel):
    items: list[str] = Field(min_length=1, max_length=20)


class MultiRecommendationResponse(BaseModel):
    input_items: list[str]
    recommendations: list[Recommendation]
