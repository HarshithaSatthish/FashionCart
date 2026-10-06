import random
from decimal import Decimal
from faker import Faker
from sqlalchemy import select
from app.core.database import Base, engine, SessionLocal
from app.core.security import hash_password
from app.models.user import User
from app.models.customer import Customer
from app.models.product import Product
from app.models.order import Order, OrderItem

Faker.seed(42)
fake = Faker()
random.seed(42)

PRODUCTS = [
    ("Classic T-Shirt", "T-Shirts"), ("Graphic T-Shirt", "T-Shirts"), ("Slim Jeans", "Jeans"), ("Blue Jeans", "Jeans"),
    ("White Sneakers", "Shoes"), ("Running Sneakers", "Shoes"), ("Summer Dress", "Dresses"), ("Party Dress", "Dresses"),
    ("Leather Handbag", "Handbags"), ("Tote Handbag", "Handbags"), ("Formal Shirt", "Shirts"), ("Casual Shirt", "Shirts"),
    ("Black Trousers", "Trousers"), ("Chino Trousers", "Trousers"), ("Sportswear Top", "Sportswear"), ("Sportswear Bottom", "Sportswear"),
    ("Denim Jacket", "Jackets"), ("Bomber Jacket", "Jackets"), ("Belt", "Accessories"), ("Cap", "Accessories"),
    ("Scarf", "Accessories"), ("Sunglasses", "Accessories"), ("Loafers", "Shoes"), ("Heels", "Shoes"),
    ("Hoodie", "Sportswear"), ("Track Pants", "Sportswear"), ("Cardigan", "Jackets"), ("Polo Shirt", "Shirts"),
    ("Cargo Trousers", "Trousers"), ("Crossbody Handbag", "Handbags"),
]


def main():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        demo_users = [
            ("FashionCart Admin", "admin@fashioncart.dev", "Admin@123", "ADMIN"),
            ("FashionCart Analyst", "analyst@fashioncart.dev", "Analyst@123", "ANALYST"),
            ("Demo User", "user@fashioncart.dev", "User@123", "USER"),
        ]
        for name, email, password, role in demo_users:
            if not db.scalar(select(User).where(User.email == email)):
                db.add(User(name=name, email=email, password_hash=hash_password(password), role=role))
        if (db.query(Product).count() or 0) == 0:
            products=[]
            for i,(name,category) in enumerate(PRODUCTS):
                products.append(Product(product_name=name, category=category, subcategory=category, brand=random.choice(["UrbanWeave","NovaStyle","ThreadLab","Stride"]), price=Decimal(str(random.randint(499,3999))), stock_quantity=500))
            db.add_all(products); db.flush()
        products = db.query(Product).all()
        by_name = {p.product_name:p for p in products}
        if (db.query(Customer).count() or 0) == 0:
            db.add_all([Customer(name=fake.name(), email=f"customer{i}@example.com", gender=random.choice(["Female","Male","Other"]), age=random.randint(18,60)) for i in range(1,101)])
            db.flush()
        customers = db.query(Customer).all()
        if (db.query(Order).count() or 0) == 0:
            patterns=[
                ["Classic T-Shirt","Slim Jeans","White Sneakers"],
                ["Summer Dress","Leather Handbag"],
                ["Formal Shirt","Black Trousers"],
                ["Running Sneakers","Sportswear Top","Track Pants"],
            ]
            for _ in range(550):
                basket = list(random.choice(patterns)) if random.random() < 0.75 else random.sample(list(by_name), k=random.randint(2,4))
                if random.random() < 0.25:
                    extra=random.choice(list(by_name))
                    if extra not in basket: basket.append(extra)
                order=Order(customer_id=random.choice(customers).id, status="COMPLETED", total_amount=Decimal("0"))
                db.add(order); db.flush()
                total=Decimal("0")
                for name in dict.fromkeys(basket):
                    p=by_name[name]; qty=1
                    db.add(OrderItem(order_id=order.id, product_id=p.id, quantity=qty, price=p.price)); total += p.price
                order.total_amount=total
        db.commit()
        print("Seed complete")
        print("Admin   : admin@fashioncart.dev / Admin@123")
        print("Analyst : analyst@fashioncart.dev / Analyst@123")
        print("User    : user@fashioncart.dev / User@123")
    finally:
        db.close()

if __name__ == "__main__":
    main()
