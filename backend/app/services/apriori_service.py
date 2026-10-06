import json
import logging
import time
from sqlalchemy.orm import Session
from app.algorithms.apriori_engine import AprioriEngine
from app.models.analysis import AnalysisRun, FrequentItemset, AssociationRule
from app.services.transaction_service import TransactionService

logger = logging.getLogger(__name__)


class AprioriService:
    @staticmethod
    def run(db: Session, *, min_support: float, min_confidence: float, min_lift: float, user_id: int):
        analysis = AnalysisRun(min_support=min_support, min_confidence=min_confidence, min_lift=min_lift, status="running")
        db.add(analysis); db.commit(); db.refresh(analysis)
        started = time.perf_counter()
        try:
            transactions = TransactionService.build_transactions(db)
            if not transactions:
                raise ValueError("No completed orders or imported transactions are available")
            itemsets, rules = AprioriEngine().run(transactions, min_support, min_confidence, min_lift)
            for itemset in itemsets:
                db.add(FrequentItemset(analysis_id=analysis.id, items=json.dumps(itemset.items), support=itemset.support))
            for rule in rules:
                db.add(AssociationRule(
                    analysis_id=analysis.id,
                    antecedent=json.dumps(rule.antecedent),
                    consequent=json.dumps(rule.consequent),
                    support=rule.support, confidence=rule.confidence, lift=rule.lift
                ))
            elapsed = int((time.perf_counter() - started) * 1000)
            analysis.transaction_count = len(transactions)
            analysis.frequent_itemset_count = len(itemsets)
            analysis.association_rule_count = len(rules)
            analysis.execution_time_ms = elapsed
            analysis.status = "completed"
            db.commit(); db.refresh(analysis)
            logger.info("Apriori user=%s analysis=%s transactions=%s params=(%s,%s,%s) elapsed_ms=%s rules=%s status=completed",
                        user_id, analysis.id, len(transactions), min_support, min_confidence, min_lift, elapsed, len(rules))
            return analysis
        except Exception as exc:
            db.rollback()
            analysis = db.get(AnalysisRun, analysis.id)
            if analysis:
                analysis.status = "failed"
                analysis.error_message = str(exc)
                analysis.execution_time_ms = int((time.perf_counter() - started) * 1000)
                db.commit()
            logger.exception("Apriori analysis failed analysis=%s", getattr(analysis, "id", None))
            raise
