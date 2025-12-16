SYSTEM_PERMISSIONS = [
    # ---- Support Groups ----
    ("support.group.create", "support", "Create support groups"),
    ("support.group.read",   "support", "View support groups"),
    ("support.group.update", "support", "Update support groups"),
    ("support.group.delete", "support", "Delete support groups"),

    # ---- Teams ----
    ("support.team.create",  "support", "Create teams"),
    ("support.team.read",    "support", "View teams"),
    ("support.team.update",  "support", "Update teams"),
    ("support.team.delete",  "support", "Delete teams"),

    # ---- Members ----
    ("support.member.add",    "support", "Add members"),
    ("support.member.remove", "support", "Remove members"),

    # ---- Projects ----
    ("project.create", "project", "Create projects"),
    ("project.read",   "project", "Read projects"),
    ("project.update", "project", "Update projects"),
    ("project.delete", "project", "Delete projects"),

    # ---- Billing ----
    ("billing.view",   "billing", "View billing"),
    ("billing.manage", "billing", "Manage billing"),
]

SYSTEM_ROLES = {
    "owner": {
        "scope": "org",
        "permissions": [
            "*",  # special case → all permissions
        ],
    },
    "admin": {
        "scope": "org",
        "permissions": [
            "support.*",
            "project.*",
        ],
    },
    "manager": {
        "scope": "group",
        "permissions": [
            "support.group.read",
            "support.group.update",
            "support.team.create",
            "support.team.update",
            "support.member.add",
            "support.member.remove",
        ],
    },
    "agent": {
        "scope": "group",
        "permissions": [
            "support.group.read",
            "support.team.read",
        ],
    },
    "viewer": {
        "scope": "org",
        "permissions": [
            "support.group.read",
            "support.team.read",
            "project.read",
        ],
    },
}

