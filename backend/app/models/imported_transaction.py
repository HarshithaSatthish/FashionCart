from datetime import datetime, timezone
from sqlalchemy import String, DateTime, Index, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base


class ImportedTransactionItem(Base):
    __tablename__ = "imported_transaction_items"
    __table_args__ = (
        UniqueConstraint("transaction_id", "product", name="uq_import_tx_product"),
        Index("ix_import_transaction", "transaction_id"),
    )
    id: Mapped[int] = mapped_column(primary_key=True)
    transaction_id: Mapped[str] = mapped_column(String(100))
    product: Mapped[str] = mapped_column(String(120), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None))
