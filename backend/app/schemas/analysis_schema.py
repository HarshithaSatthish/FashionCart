from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict


class AnalysisRunRequest(BaseModel):
    min_support: float = Field(default=0.05, gt=0, le=1)
    min_confidence: float = Field(default=0.30, gt=0, le=1)
    min_lift: float = Field(default=1.0, gt=0)
    model_config = ConfigDict(json_schema_extra={
        "example": {"min_support": 0.05, "min_confidence": 0.30, "min_lift": 1.0}
    })


class AnalysisSummary(BaseModel):
    analysis_id: int
    transaction_count: int
    frequent_itemsets: int
    association_rules: int
    execution_time_ms: int
    status: str


class AnalysisResponse(BaseModel):
    id: int
    min_support: float
    min_confidence: float
    min_lift: float
    transaction_count: int
    frequent_itemset_count: int
    association_rule_count: int
    execution_time_ms: int
    status: str
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class ItemsetResponse(BaseModel):
    items: list[str]
    support: float


class RuleResponse(BaseModel):
    id: int
    antecedent: list[str]
    consequent: list[str]
    support: float
    confidence: float
    lift: float
