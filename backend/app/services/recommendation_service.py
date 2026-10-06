import json
from collections import defaultdict
from fastapi import HTTPException
from sqlalchemy.orm import Session
from app.repositories.rule_repository import RuleRepository


class RecommendationService:
    @staticmethod
    def recommend(db: Session, input_items: list[str], limit: int = 10):
        analysis_id = RuleRepository.latest_analysis_id(db)
        if not analysis_id:
            raise HTTPException(status_code=404, detail={"code": "NO_ANALYSIS", "message": "Run Apriori analysis first"})
        input_norm = {x.strip().lower() for x in input_items if x.strip()}
        scores = defaultdict(list)
        for rule in RuleRepository.for_analysis(db, analysis_id):
            antecedent = json.loads(rule.antecedent)
            consequent = json.loads(rule.consequent)
            ant_norm = {x.lower() for x in antecedent}
            if ant_norm and ant_norm.issubset(input_norm):
                for product in consequent:
                    if product.lower() not in input_norm:
                        scores[product].append((rule.lift, rule.confidence, rule.support))
        recommendations = []
        for product, metrics in scores.items():
            best = max(metrics, key=lambda x: (x[0], x[1], x[2]))
            recommendations.append({"product": product, "lift": best[0], "confidence": best[1], "support": best[2]})
        recommendations.sort(key=lambda x: (-x["lift"], -x["confidence"], -x["support"], x["product"]))
        return recommendations[:limit]
