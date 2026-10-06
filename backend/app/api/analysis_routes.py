import json
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, desc, or_
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import require_roles
from app.models.analysis import AnalysisRun, AssociationRule, FrequentItemset
from app.models.user import User
from app.schemas.analysis_schema import AnalysisRunRequest, AnalysisSummary, AnalysisResponse, RuleResponse, ItemsetResponse
from app.services.apriori_service import AprioriService

router = APIRouter(prefix="/analysis", tags=["Apriori Analysis"])

@router.post("/run", response_model=AnalysisSummary)
def run_analysis(data: AnalysisRunRequest, db: Session = Depends(get_db), user: User = Depends(require_roles("ADMIN", "ANALYST"))):
    try:
        a = AprioriService.run(db, min_support=data.min_support, min_confidence=data.min_confidence, min_lift=data.min_lift, user_id=user.id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail={"code": "ANALYSIS_INPUT_ERROR", "message": str(exc)})
    return {"analysis_id": a.id, "transaction_count": a.transaction_count, "frequent_itemsets": a.frequent_itemset_count,
            "association_rules": a.association_rule_count, "execution_time_ms": a.execution_time_ms, "status": a.status}

@router.get("", response_model=list[AnalysisResponse])
def list_analyses(db: Session = Depends(get_db), _: User = Depends(require_roles("ADMIN", "ANALYST"))):
    return db.scalars(select(AnalysisRun).order_by(desc(AnalysisRun.created_at), desc(AnalysisRun.id)).limit(100)).all()

@router.get("/{analysis_id}", response_model=AnalysisResponse)
def get_analysis(analysis_id: int, db: Session = Depends(get_db), _: User = Depends(require_roles("ADMIN", "ANALYST"))):
    obj = db.get(AnalysisRun, analysis_id)
    if not obj: raise HTTPException(status_code=404, detail={"code": "ANALYSIS_NOT_FOUND", "message": "Analysis not found"})
    return obj

@router.get("/{analysis_id}/rules", response_model=list[RuleResponse])
def get_rules(analysis_id: int, min_lift: float | None = Query(None, gt=0), min_confidence: float | None = Query(None, ge=0, le=1), product: str | None = None,
              sort_by: str = "lift", db: Session = Depends(get_db), _: User = Depends(require_roles("ADMIN", "ANALYST"))):
    if not db.get(AnalysisRun, analysis_id): raise HTTPException(status_code=404, detail={"code": "ANALYSIS_NOT_FOUND", "message": "Analysis not found"})
    stmt = select(AssociationRule).where(AssociationRule.analysis_id == analysis_id)
    if min_lift is not None: stmt = stmt.where(AssociationRule.lift >= min_lift)
    if min_confidence is not None: stmt = stmt.where(AssociationRule.confidence >= min_confidence)
    if product:
        # Rules are persisted as JSON text; filter at the database level so a
        # product query does not load the full rule set into Python first.
        needle = f'%"{product.strip()}"%'
        stmt = stmt.where(or_(AssociationRule.antecedent.ilike(needle), AssociationRule.consequent.ilike(needle)))
    sort_cols = {"lift": AssociationRule.lift, "confidence": AssociationRule.confidence, "support": AssociationRule.support}
    stmt = stmt.order_by(desc(sort_cols.get(sort_by, AssociationRule.lift)))
    rows = db.scalars(stmt).all()
    return [
        {
            "id": r.id,
            "antecedent": json.loads(r.antecedent),
            "consequent": json.loads(r.consequent),
            "support": r.support,
            "confidence": r.confidence,
            "lift": r.lift,
        }
        for r in rows
    ]

@router.get("/{analysis_id}/itemsets", response_model=list[ItemsetResponse])
def get_itemsets(analysis_id: int, db: Session = Depends(get_db), _: User = Depends(require_roles("ADMIN", "ANALYST"))):
    if not db.get(AnalysisRun, analysis_id): raise HTTPException(status_code=404, detail={"code": "ANALYSIS_NOT_FOUND", "message": "Analysis not found"})
    rows = db.scalars(select(FrequentItemset).where(FrequentItemset.analysis_id == analysis_id).order_by(desc(FrequentItemset.support))).all()
    return [{"items": json.loads(x.items), "support": x.support} for x in rows]
