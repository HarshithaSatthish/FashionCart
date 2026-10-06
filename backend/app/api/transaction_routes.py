from collections import defaultdict
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from sqlalchemy import select, func, desc
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import require_roles
from app.models.imported_transaction import ImportedTransactionItem
from app.models.user import User
from app.services.transaction_service import TransactionService
from app.core.rate_limit import rate_limit

router = APIRouter(prefix="/transactions", tags=["Transactions"])
MAX_CSV_BYTES = 10 * 1024 * 1024
ALLOWED_CONTENT_TYPES = {
    "text/csv", "application/csv", "application/vnd.ms-excel", "text/plain",
    "application/octet-stream"
}


@router.get("", summary="List imported transaction baskets")
def list_transactions(
    page: int = Query(1, ge=1),
    limit: int = Query(25, ge=1, le=100),
    search: str | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("ADMIN", "ANALYST")),
):
    # Fetch transaction ids first so pagination is by basket, not by item row.
    id_stmt = select(ImportedTransactionItem.transaction_id).distinct()
    if search:
        id_stmt = id_stmt.where(ImportedTransactionItem.transaction_id.ilike(f"%{search.strip()}%"))
    id_stmt = id_stmt.order_by(desc(ImportedTransactionItem.transaction_id)).offset((page - 1) * limit).limit(limit)
    ids = list(db.scalars(id_stmt).all())
    if not ids:
        return {"items": [], "page": page, "limit": limit, "total": 0}
    rows = db.scalars(
        select(ImportedTransactionItem)
        .where(ImportedTransactionItem.transaction_id.in_(ids))
        .order_by(desc(ImportedTransactionItem.created_at), ImportedTransactionItem.id)
    ).all()
    grouped: dict[str, dict] = {}
    for row in rows:
        entry = grouped.setdefault(row.transaction_id, {
            "transaction_id": row.transaction_id,
            "products": [],
            "item_count": 0,
            "source": "CSV",
            "imported_at": row.created_at,
        })
        entry["products"].append(row.product)
        entry["item_count"] += 1
        if row.created_at > entry["imported_at"]:
            entry["imported_at"] = row.created_at
    total_stmt = select(func.count(func.distinct(ImportedTransactionItem.transaction_id)))
    if search:
        total_stmt = total_stmt.where(ImportedTransactionItem.transaction_id.ilike(f"%{search.strip()}%"))
    total = int(db.scalar(total_stmt) or 0)
    # Retain the same order as the paginated id list.
    return {"items": [grouped[x] for x in ids if x in grouped], "page": page, "limit": limit, "total": total}


@router.get("/stats", summary="Get imported transaction statistics")
def transaction_stats(db: Session = Depends(get_db), _: User = Depends(require_roles("ADMIN", "ANALYST"))):
    baskets = int(db.scalar(select(func.count(func.distinct(ImportedTransactionItem.transaction_id)))) or 0)
    rows = int(db.scalar(select(func.count(ImportedTransactionItem.id))) or 0)
    products = int(db.scalar(select(func.count(func.distinct(ImportedTransactionItem.product)))) or 0)
    return {"transactions": baskets, "rows": rows, "unique_products": products}


@router.post(
    "/upload",
    summary="Upload historical transaction CSV",
    description="Validates and imports transaction_id/product rows for later Apriori analysis. ADMIN or ANALYST only.",
)
async def upload_transactions(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("ADMIN", "ANALYST")),
    __: None = Depends(rate_limit("upload", 20)),
):
    if not file.filename or not file.filename.lower().endswith(".csv") or file.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(status_code=400, detail={"code": "INVALID_FILE_TYPE", "message": "Only CSV files are allowed"})
    raw = await file.read(MAX_CSV_BYTES + 1)
    if len(raw) > MAX_CSV_BYTES:
        raise HTTPException(status_code=400, detail={"code": "FILE_TOO_LARGE", "message": "CSV must be 10 MB or smaller"})
    try:
        return TransactionService.import_csv(db, raw)
    except (ValueError, UnicodeDecodeError) as exc:
        raise HTTPException(status_code=400, detail={"code": "INVALID_CSV", "message": str(exc)})
