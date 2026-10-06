from app.core.database import SessionLocal
from app.models.analysis import AnalysisRun, AssociationRule
import json


def test_recommendation_from_stored_rules(client, admin_headers):
    db=SessionLocal()
    a=AnalysisRun(min_support=.1,min_confidence=.2,min_lift=1,transaction_count=10,frequent_itemset_count=2,association_rule_count=1,status='completed')
    db.add(a); db.flush()
    db.add(AssociationRule(analysis_id=a.id,antecedent=json.dumps(['T-Shirt']),consequent=json.dumps(['Jeans']),support=.5,confidence=.8,lift=1.4))
    db.commit(); db.close()
    r=client.get('/api/recommendations/T-Shirt',headers=admin_headers)
    assert r.status_code==200
    assert r.json()['recommendations'][0]['product']=='Jeans'
