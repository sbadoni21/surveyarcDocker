from sqlalchemy.orm import Session
from app.db import SessionLocal
from app.models.rbac.permission import Permission, Role, RolePermission, RoleScope
from uuid import uuid4

from app.policies.rbac_definitions import SYSTEM_PERMISSIONS, SYSTEM_ROLES


def seed_permissions(db: Session):
    existing = {p.code for p in db.query(Permission.code).all()}

    for code, module, desc in SYSTEM_PERMISSIONS:
        if code in existing:
            continue

        db.add(
            Permission(
                id=str(uuid4()),
                code=code,
                module=module,
                description=desc,
            )
        )

    db.commit()


def seed_roles(db: Session):
    perms = {p.code: p.id for p in db.query(Permission).all()}
    existing_roles = {r.name: r for r in db.query(Role).all()}

    for role_name, cfg in SYSTEM_ROLES.items():
        if role_name in existing_roles:
            role = existing_roles[role_name]
        else:
            role = Role(
                id=str(uuid4()),
                name=role_name,
                scope=RoleScope(cfg["scope"]),
                is_system=True,
            )
            db.add(role)
            db.flush()

        # Clear existing mappings (safe re-run)
        db.query(RolePermission).filter(
            RolePermission.role_id == role.id
        ).delete()

        # Assign permissions
        for perm_expr in cfg["permissions"]:
            if perm_expr == "*":
                for pid in perms.values():
                    db.add(RolePermission(role_id=role.id, permission_id=pid))
            elif perm_expr.endswith(".*"):
                prefix = perm_expr[:-2]
                for code, pid in perms.items():
                    if code.startswith(prefix):
                        db.add(RolePermission(role_id=role.id, permission_id=pid))
            else:
                pid = perms.get(perm_expr)
                if pid:
                    db.add(RolePermission(role_id=role.id, permission_id=pid))

    db.commit()


def main():
    db = SessionLocal()
    try:
        seed_permissions(db)
        seed_roles(db)
        print("✅ RBAC seed completed")
    finally:
        db.close()


if __name__ == "__main__":
    main()
