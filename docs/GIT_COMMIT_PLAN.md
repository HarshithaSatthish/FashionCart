# Suggested Git Commit Plan

If this ZIP is being turned into a new GitHub repository, avoid a single giant initial commit. A clean interview-friendly history can be reconstructed in these stages:

1. `feat: initialize FastAPI backend and configuration`
2. `feat: add SQLAlchemy models and MySQL schema`
3. `feat: implement JWT authentication and RBAC`
4. `feat: add product and customer APIs`
5. `feat: add order management and stock validation`
6. `feat: add CSV transaction import workflow`
7. `feat: implement reusable Apriori engine`
8. `feat: persist analysis runs itemsets and rules`
9. `feat: add stored-rule recommendation APIs`
10. `feat: add analytics dashboard endpoints`
11. `feat: integrate Stitch-inspired responsive frontend`
12. `test: add API and Apriori regression coverage`
13. `feat: add Docker Compose and Nginx deployment`
14. `docs: add API deployment and interview documentation`

Commit the matching files at each stage rather than committing the complete extracted ZIP at once.
