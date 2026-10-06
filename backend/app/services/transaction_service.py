import io
import logging
import pandas as pd
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.models.imported_transaction import ImportedTransactionItem
from app.repositories.transaction_repository import TransactionRepository

logger = logging.getLogger(__name__)


class TransactionService:
    @staticmethod
    def build_transactions(db: Session) -> list[list[str]]:
        return TransactionRepository.from_completed_orders(db) + TransactionRepository.from_imports(db)

    @staticmethod
    def import_csv(db: Session, raw: bytes) -> dict:
        df = pd.read_csv(io.BytesIO(raw))
        required = {"transaction_id", "product"}
        if not required.issubset(df.columns):
            raise ValueError("CSV must contain transaction_id and product columns")
        total_rows = len(df)
        df = df[["transaction_id", "product"]].copy()
        missing_mask = df["transaction_id"].isna() | df["product"].isna()
        invalid_rows = int(missing_mask.sum())
        df = df[~missing_mask]
        df["transaction_id"] = df["transaction_id"].astype(str).str.strip()
        df["product"] = df["product"].astype(str).str.strip()
        blank_mask = (df["transaction_id"] == "") | (df["product"] == "")
        invalid_rows += int(blank_mask.sum())
        df = df[~blank_mask]
        duplicate_rows = int(df.duplicated(subset=["transaction_id", "product"]).sum())
        df = df.drop_duplicates(subset=["transaction_id", "product"])

        existing = set(db.execute(select(ImportedTransactionItem.transaction_id, ImportedTransactionItem.product)).all())
        inserted = 0
        for row in df.itertuples(index=False):
            key = (row.transaction_id, row.product)
            if key in existing:
                duplicate_rows += 1
                continue
            db.add(ImportedTransactionItem(transaction_id=row.transaction_id, product=row.product))
            existing.add(key); inserted += 1
        db.commit()
        logger.info("CSV import total=%s inserted=%s invalid=%s duplicates=%s", total_rows, inserted, invalid_rows, duplicate_rows)
        return {"total_rows": total_rows, "valid_rows": inserted, "invalid_rows": invalid_rows, "duplicate_rows": duplicate_rows, "status": "completed"}
