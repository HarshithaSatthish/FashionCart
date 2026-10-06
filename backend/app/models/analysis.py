from datetime import datetime, timezone
from sqlalchemy import String, DateTime, Float, Integer, ForeignKey, Text, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


class AnalysisRun(Base):
    __tablename__ = "analysis_runs"
    __table_args__ = (Index("ix_analysis_status_created", "status", "created_at"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    min_support: Mapped[float] = mapped_column(Float)
    min_confidence: Mapped[float] = mapped_column(Float)
    min_lift: Mapped[float] = mapped_column(Float)
    transaction_count: Mapped[int] = mapped_column(Integer, default=0)
    frequent_itemset_count: Mapped[int] = mapped_column(Integer, default=0)
    association_rule_count: Mapped[int] = mapped_column(Integer, default=0)
    execution_time_ms: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String(30), default="running")
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None))
    itemsets = relationship("FrequentItemset", cascade="all, delete-orphan", back_populates="analysis")
    rules = relationship("AssociationRule", cascade="all, delete-orphan", back_populates="analysis")


class FrequentItemset(Base):
    __tablename__ = "frequent_itemsets"
    id: Mapped[int] = mapped_column(primary_key=True)
    analysis_id: Mapped[int] = mapped_column(ForeignKey("analysis_runs.id", ondelete="CASCADE"), index=True)
    items: Mapped[str] = mapped_column(Text)
    support: Mapped[float] = mapped_column(Float, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None))
    analysis = relationship("AnalysisRun", back_populates="itemsets")


class AssociationRule(Base):
    __tablename__ = "association_rules"
    __table_args__ = (
        Index("ix_rules_analysis_lift", "analysis_id", "lift"),
        Index("ix_rules_analysis_confidence", "analysis_id", "confidence"),
    )
    id: Mapped[int] = mapped_column(primary_key=True)
    analysis_id: Mapped[int] = mapped_column(ForeignKey("analysis_runs.id", ondelete="CASCADE"), index=True)
    antecedent: Mapped[str] = mapped_column(Text)
    consequent: Mapped[str] = mapped_column(Text)
    support: Mapped[float] = mapped_column(Float)
    confidence: Mapped[float] = mapped_column(Float)
    lift: Mapped[float] = mapped_column(Float)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None))
    analysis = relationship("AnalysisRun", back_populates="rules")
