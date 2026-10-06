from sqlalchemy import select, desc
from sqlalchemy.orm import Session
from app.models.analysis import AnalysisRun, AssociationRule


class RuleRepository:
    @staticmethod
    def latest_analysis_id(db: Session) -> int | None:
        return db.scalar(select(AnalysisRun.id).where(AnalysisRun.status == "completed").order_by(desc(AnalysisRun.created_at), desc(AnalysisRun.id)).limit(1))

    @staticmethod
    def for_analysis(db: Session, analysis_id: int):
        return db.scalars(select(AssociationRule).where(AssociationRule.analysis_id == analysis_id)).all()
