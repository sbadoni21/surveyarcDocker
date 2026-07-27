# app/services/user_permission_service.py

from sqlalchemy.orm import Session
from sqlalchemy import text
from uuid import uuid4
from typing import Optional, List, Dict
from fastapi import HTTPException

from app.models.rbac.permission import Permission, AssignmentScope


class UserPermissionService:
    """
    Service for managing individual user permissions (custom grants and denials)
    """

    def __init__(self, db: Session):
        self.db = db

    # =====================================================
    # GET EFFECTIVE PERMISSIONS
    # =====================================================

    def get_effective_permissions(
        self,
        user_uid: str,
        org_id: str,
        scope: Optional[str] = None,
        resource_id: Optional[str] = None,
    ) -> Dict:
        """
        Get all effective permissions for a user, grouped by source:
        - Role-based permissions
        - Custom grants
        - Denials
        """
        
        # 1. Get permissions from roles
        role_perms = self._get_role_permissions(user_uid, org_id, scope, resource_id)
        
        # 2. Get custom grants
        custom_grants = self._get_custom_grants(user_uid, org_id, scope, resource_id)
        
        # 3. Get denials
        denials = self._get_denials(user_uid, org_id, scope, resource_id)
        
        # 4. Calculate effective permissions
        all_granted = set(role_perms + custom_grants)
        denied_set = set(denials)
        effective = list(all_granted - denied_set)
        scope = scope or "org"
        resource_id = resource_id
        return {
            "user_uid": user_uid,
            "org_id": org_id,
            "scope": scope,
            "resource_id": resource_id,
            "effective_permissions": sorted(effective),
            "breakdown": {
                "from_roles": sorted(role_perms),
                "custom_grants": sorted(custom_grants),
                "denials": sorted(denials),
            }
        }

    def _get_role_permissions(
        self,
        user_uid: str,
        org_id: str,
        scope: Optional[str] = None,
        resource_id: Optional[str] = None,
    ) -> List[str]:
        """Get permissions from user's assigned roles"""
        
        query = text("""
            SELECT DISTINCT p.code
            FROM user_role_assignments ura
            JOIN role_permissions rp ON ura.role_id = rp.role_id
            JOIN permissions p ON rp.permission_id = p.id
            WHERE ura.user_uid = :user_uid
            AND ura.resource_id = :org_id
        """)
        
        if scope:
            query = text("""
                SELECT DISTINCT p.code
                FROM user_role_assignments ura
                JOIN role_permissions rp ON ura.role_id = rp.role_id
                JOIN permissions p ON rp.permission_id = p.id
                WHERE ura.user_uid = :user_uid
                AND ura.scope = :scope
                AND ura.resource_id = :resource_id
            """)
        
        params = {
            "user_uid": user_uid,
            "org_id": org_id,
            "scope": scope or "org",
            "resource_id": resource_id or org_id,
        }
        
        result = self.db.execute(query, params)
        return [row[0] for row in result.fetchall()]

    def _get_custom_grants(
        self,
        user_uid: str,
        org_id: str,
        scope: Optional[str] = None,
        resource_id: Optional[str] = None,
    ) -> List[str]:
        """Get custom permission grants"""
        
        try:
            query = text("""
                SELECT DISTINCT p.code
                FROM user_custom_permissions ucp
                JOIN permissions p ON ucp.permission_id = p.id
                WHERE ucp.user_uid = :user_uid
                AND ucp.resource_id = :org_id
            """)
            
            if scope:
                query = text("""
                    SELECT DISTINCT p.code
                    FROM user_custom_permissions ucp
                    JOIN permissions p ON ucp.permission_id = p.id
                    WHERE ucp.user_uid = :user_uid
                    AND ucp.scope = :scope
                    AND ucp.resource_id = :resource_id
                """)
            
            params = {
                "user_uid": user_uid,
                "org_id": org_id,
                "scope": scope or "org",
                "resource_id": resource_id or org_id,
            }
            
            result = self.db.execute(query, params)
            return [row[0] for row in result.fetchall()]
        except Exception as e:
            # Table might not exist yet
            print(f"[WARN] Could not fetch custom grants: {e}")
            return []

    def _get_denials(
        self,
        user_uid: str,
        org_id: str,
        scope: Optional[str] = None,
        resource_id: Optional[str] = None,
    ) -> List[str]:
        """Get denied permissions"""
        
        try:
            query = text("""
                SELECT DISTINCT permission_code
                FROM permission_denies
                WHERE user_uid = :user_uid
                AND resource_id = :org_id
            """)
            
            if scope:
                query = text("""
                    SELECT DISTINCT permission_code
                    FROM permission_denies
                    WHERE user_uid = :user_uid
                    AND scope = :scope
                    AND resource_id = :resource_id
                """)
            
            params = {
                "user_uid": user_uid,
                "org_id": org_id,
                "scope": scope or "org",
                "resource_id": resource_id or org_id,
            }
            
            result = self.db.execute(query, params)
            return [row[0] for row in result.fetchall()]
        except Exception as e:
            # Table might not exist yet
            print(f"[WARN] Could not fetch denials: {e}")
            return []

    # =====================================================
    # GRANT CUSTOM PERMISSION
    # =====================================================

    def grant_permission(
        self,
        user_uid: str,
        permission_code: str,
        scope: str,
        resource_id: str,
        granted_by: str,
    ) -> Dict:
        """
        Grant a custom permission to a user
        """
        
        # Verify permission exists
        permission = (
            self.db.query(Permission)
            .filter(Permission.code == permission_code)
            .first()
        )
        
        if not permission:
            raise HTTPException(
                status_code=404,
                detail=f"Permission '{permission_code}' not found"
            )
        
        # Check if already granted
        check_query = text("""
            SELECT id FROM user_custom_permissions
            WHERE user_uid = :user_uid
            AND permission_id = :permission_id
            AND scope = :scope
            AND resource_id = :resource_id
        """)
        
        existing = self.db.execute(check_query, {
            "user_uid": user_uid,
            "permission_id": permission.id,
            "scope": scope,
            "resource_id": resource_id,
        }).fetchone()
        
        if existing:
            return {
                "status": "already_exists",
                "message": "Permission already granted",
                "id": existing[0]
            }
        
        # Insert grant
        grant_id = str(uuid4())
        insert_query = text("""
            INSERT INTO user_custom_permissions
            (id, user_uid, permission_id, scope, resource_id, granted_by, created_at)
            VALUES (:id, :user_uid, :permission_id, :scope, :resource_id, :granted_by, NOW())
        """)
        
        self.db.execute(insert_query, {
            "id": grant_id,
            "user_uid": user_uid,
            "permission_id": permission.id,
            "scope": scope,
            "resource_id": resource_id,
            "granted_by": granted_by,
        })
        
        self.db.commit()
        
        return {
            "status": "success",
            "message": f"Permission '{permission_code}' granted to user",
            "id": grant_id,
            "permission_code": permission_code,
            "user_uid": user_uid,
            "scope": scope,
            "resource_id": resource_id,
        }

    # =====================================================
    # REVOKE CUSTOM PERMISSION
    # =====================================================

    def revoke_permission(
        self,
        user_uid: str,
        permission_code: str,
        scope: str,
        resource_id: str,
    ) -> Dict:
        """
        Revoke a custom permission from a user (SAFE + IDEMPOTENT)
        """

        # 1️⃣ Verify permission exists
        permission = (
            self.db.query(Permission)
            .filter(Permission.code == permission_code)
            .first()
        )

        if not permission:
            raise HTTPException(
                status_code=404,
                detail=f"Permission '{permission_code}' not found"
            )

        # 2️⃣ Check existence BEFORE delete
        exists = self.db.execute(
            text("""
                SELECT 1 FROM user_custom_permissions
                WHERE user_uid = :user_uid
                AND permission_id = :permission_id
                AND scope = :scope
                AND resource_id = :resource_id
                LIMIT 1
            """),
            {
                "user_uid": user_uid,
                "permission_id": permission.id,
                "scope": scope,
                "resource_id": resource_id,
            }
        ).fetchone()

        if not exists:
            return {
                "status": "noop",
                "message": "Permission already revoked",
                "permission_code": permission_code,
                "user_uid": user_uid,
            }

        # 3️⃣ Delete
        self.db.execute(
            text("""
                DELETE FROM user_custom_permissions
                WHERE user_uid = :user_uid
                AND permission_id = :permission_id
                AND scope = :scope
                AND resource_id = :resource_id
            """),
            {
                "user_uid": user_uid,
                "permission_id": permission.id,
                "scope": scope,
                "resource_id": resource_id,
            }
        )

        self.db.commit()

        return {
            "status": "success",
            "message": f"Permission '{str(permission_code)}' denied for user",
            "permission_code": str(permission_code),
            "user_uid": str(user_uid),
            "scope": str(scope),
            "resource_id": str(resource_id),
        }


    # =====================================================
    # DENY PERMISSION
    # =====================================================

    def deny_permission(
        self,
        user_uid: str,
        permission_code: str,
        scope: str,
        resource_id: str,
        denied_by: str,
        reason: Optional[str] = None,
    ) -> Dict:
        """
        Explicitly deny a permission for a user (SAFE + REDIS-PROTECTED)
        """

        # 1️⃣ Check if already denied
        existing = self.db.execute(
            text("""
                SELECT id FROM permission_denies
                WHERE user_uid = :user_uid
                AND permission_code = :permission_code
                AND scope = :scope
                AND resource_id = :resource_id
                LIMIT 1
            """),
            {
                "user_uid": user_uid,
                "permission_code": permission_code,
                "scope": scope,
                "resource_id": resource_id,
            }
        ).fetchone()

        if existing:
            return {
                "status": "noop",
                "message": "Permission already denied",
                "id": existing[0],
                "permission_code": permission_code,
                "user_uid": user_uid,
            }

        # 2️⃣ Insert denial
        denial_id = str(uuid4())

        self.db.execute(
            text("""
                INSERT INTO permission_denies
                (id, user_uid, permission_code, scope, resource_id, denied_by, reason, created_at)
                VALUES (:id, :user_uid, :permission_code, :scope, :resource_id, :denied_by, :reason, NOW())
            """),
            {
                "id": denial_id,
                "user_uid": user_uid,
                "permission_code": permission_code,
                "scope": scope,
                "resource_id": resource_id,
                "denied_by": denied_by,
                "reason": reason,
            }
        )

        self.db.commit()

        return {
            "status": "success",
            "message": f"Permission '{str(permission_code)}' denied for user",
            "id": str(denial_id),
            "permission_code": str(permission_code),
            "user_uid": str(user_uid),
            "scope": str(scope),
            "resource_id": str(resource_id),
        }


        # =====================================================
        # REMOVE DENIAL
        # =====================================================

    def remove_denial(
        self,
        user_uid: str,
        permission_code: str,
        scope: str,
        resource_id: str,
    ) -> Dict:
        """
        Remove a permission denial
        """
        
        delete_query = text("""
            DELETE FROM permission_denies
            WHERE user_uid = :user_uid
            AND permission_code = :permission_code
            AND scope = :scope
            AND resource_id = :resource_id
        """)
        
        result = self.db.execute(delete_query, {
            "user_uid": user_uid,
            "permission_code": permission_code,
            "scope": scope,
            "resource_id": resource_id,
        })
        
        self.db.commit()
        
        if result.rowcount == 0:
            raise HTTPException(
                status_code=404,
                detail="Permission denial not found"
            )
        
        return {
            "status": "success",
            "message": f"Permission '{str(permission_code)}' denied for user",
            "permission_code": str(permission_code),
            "user_uid": str(user_uid),
            "scope": str(scope),
            "resource_id": str(resource_id),
        }


    # =====================================================
    # LIST CUSTOM GRANTS
    # =====================================================

    def list_custom_grants(
        self,
        user_uid: str,
        org_id: Optional[str] = None,
    ) -> List[Dict]:
        """
        List all custom permission grants for a user
        """
        
        query = text("""
            SELECT 
                ucp.id,
                ucp.user_uid,
                p.code as permission_code,
                p.module,
                p.description,
                ucp.scope,
                ucp.resource_id,
                ucp.granted_by,
                ucp.created_at
            FROM user_custom_permissions ucp
            JOIN permissions p ON ucp.permission_id = p.id
            WHERE ucp.user_uid = :user_uid
        """)
        
        params = {"user_uid": user_uid}
        
        if org_id:
            query = text("""
                SELECT 
                    ucp.id,
                    ucp.user_uid,
                    p.code as permission_code,
                    p.module,
                    p.description,
                    ucp.scope,
                    ucp.resource_id,
                    ucp.granted_by,
                    ucp.created_at
                FROM user_custom_permissions ucp
                JOIN permissions p ON ucp.permission_id = p.id
                WHERE ucp.user_uid = :user_uid
                AND ucp.resource_id = :org_id
            """)
            params["org_id"] = org_id
        
        try:
            result = self.db.execute(query, params)
            
            grants = []
            for row in result.fetchall():
                grants.append({
                    "id": row[0],
                    "user_uid": row[1],
                    "permission_code": row[2],
                    "module": row[3],
                    "description": row[4],
                    "scope": row[5],
                    "resource_id": row[6],
                    "granted_by": row[7],
                    "created_at": row[8].isoformat() if row[8] else None,
                })
            
            return grants
        except Exception as e:
            print(f"[WARN] Could not list custom grants: {e}")
            return []

    # =====================================================
    # LIST DENIALS
    # =====================================================

    def list_denials(
        self,
        user_uid: str,
        org_id: Optional[str] = None,
    ) -> List[Dict]:
        """
        List all permission denials for a user
        """
        
        query = text("""
            SELECT 
                id,
                user_uid,
                permission_code,
                scope,
                resource_id,
                denied_by,
                reason,
                created_at
            FROM permission_denies
            WHERE user_uid = :user_uid
        """)
        
        params = {"user_uid": user_uid}
        
        if org_id:
            query = text("""
                SELECT 
                    id,
                    user_uid,
                    permission_code,
                    scope,
                    resource_id,
                    denied_by,
                    reason,
                    created_at
                FROM permission_denies
                WHERE user_uid = :user_uid
                AND resource_id = :org_id
            """)
            params["org_id"] = org_id
        
        try:
            result = self.db.execute(query, params)
            
            denials = []
            for row in result.fetchall():
                denials.append({
                    "id": row[0],
                    "user_uid": row[1],
                    "permission_code": row[2],
                    "scope": row[3],
                    "resource_id": row[4],
                    "denied_by": row[5],
                    "reason": row[6],
                    "created_at": row[7].isoformat() if row[7] else None,
                })
            
            return denials
        except Exception as e:
            print(f"[WARN] Could not list denials: {e}")
            return []
    def bulk_grant_permissions(
        self,
        user_uid: str,
        permission_codes: list[str],
        scope: str,
        resource_id: str,
        granted_by: str,
    ) -> dict:
        if not permission_codes:
            return {"status": "noop", "added": 0}

        # 1️⃣ Fetch permissions
        permissions = (
            self.db.query(Permission)
            .filter(Permission.code.in_(permission_codes))
            .all()
        )

        if len(permissions) != len(permission_codes):
            raise HTTPException(404, "One or more permissions not found")

        perm_map = {p.code: p.id for p in permissions}

        # 2️⃣ Find existing grants
        existing = self.db.execute(
            text("""
                SELECT permission_id FROM user_custom_permissions
                WHERE user_uid = :user_uid
                AND scope = :scope
                AND resource_id = :resource_id
                AND permission_id = ANY(:perm_ids)
            """),
            {
                "user_uid": user_uid,
                "scope": scope,
                "resource_id": resource_id,
                "perm_ids": list(perm_map.values()),
            },
        ).fetchall()

        existing_ids = {row[0] for row in existing}

        # 3️⃣ Prepare bulk inserts
        rows = []
        for code, perm_id in perm_map.items():
            if perm_id not in existing_ids:
                rows.append({
                    "id": str(uuid4()),
                    "user_uid": user_uid,
                    "permission_id": perm_id,
                    "scope": scope,
                    "resource_id": resource_id,
                    "granted_by": granted_by,
                })

        if rows:
            self.db.execute(
                text("""
                    INSERT INTO user_custom_permissions
                    (id, user_uid, permission_id, scope, resource_id, granted_by, created_at)
                    VALUES (:id, :user_uid, :permission_id, :scope, :resource_id, :granted_by, NOW())
                """),
                rows,
            )
            self.db.commit()

        return {
            "status": "success",
            "requested": len(permission_codes),
            "added": len(rows),
            "skipped": len(permission_codes) - len(rows),
        }

