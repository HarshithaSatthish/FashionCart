import json
from sqlalchemy import select, func, desc
from sqlalchemy.orm import Session
from fastapi import APIRouter, Depends
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.customer import Customer
from app.models.product import Product
from app.models.order import Order
from app.models.analysis import AnalysisRun, AssociationRule
from app.models.imported_transaction import ImportedTransactionItem
from app.models.user import User

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("", summary="Get analytics dashboard metrics")
def dashboard(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    latest = db.scalar(
        select(AnalysisRun)
        .where(AnalysisRun.status == "completed")
        .order_by(desc(AnalysisRun.created_at), desc(AnalysisRun.id))
        .limit(1)
    )
    top_rules = []
    avg_support = avg_confidence = 0.0
    if latest:
        rows = db.scalars(
            select(AssociationRule)
            .where(AssociationRule.analysis_id == latest.id)
            .order_by(desc(AssociationRule.lift), desc(AssociationRule.confidence))
            .limit(5)
        ).all()
        top_rules = [
            {
                "antecedent": json.loads(r.antecedent),
                "consequent": json.loads(r.consequent),
                "support": r.support,
                "confidence": r.confidence,
                "lift": r.lift,
            }
            for r in rows
        ]
        avg_support = db.scalar(select(func.avg(AssociationRule.support)).where(AssociationRule.analysis_id == latest.id)) or 0.0
        avg_confidence = db.scalar(select(func.avg(AssociationRule.confidence)).where(AssociationRule.analysis_id == latest.id)) or 0.0

    if user.role == "USER":
        # Shoppers get catalog-level insight only: no customer/order/transaction business metrics.
        return {
            "total_products": db.scalar(select(func.count(Product.id))) or 0,
            "association_rules": latest.association_rule_count if latest else 0,
            "highest_lift_rules": top_rules,
            "top_rule": top_rules[0] if top_rules else None,
        }

    imported_tx_count = db.scalar(select(func.count(func.distinct(ImportedTransactionItem.transaction_id)))) or 0
    completed_order_count = db.scalar(select(func.count(Order.id)).where(Order.status == "COMPLETED")) or 0
    return {
        "total_customers": db.scalar(select(func.count(Customer.id))) or 0,
        "total_products": db.scalar(select(func.count(Product.id))) or 0,
        "total_orders": db.scalar(select(func.count(Order.id))) or 0,
        "total_transactions": int(completed_order_count) + int(imported_tx_count),
        "completed_order_transactions": completed_order_count,
        "imported_transactions": imported_tx_count,
        "latest_analysis": latest.id if latest else None,
        "frequent_itemsets": latest.frequent_itemset_count if latest else 0,
        "association_rules": latest.association_rule_count if latest else 0,
        "average_support": float(avg_support),
        "average_confidence": float(avg_confidence),
        "highest_lift_rules": top_rules,
        "top_rule": top_rules[0] if top_rules else None,
    }
