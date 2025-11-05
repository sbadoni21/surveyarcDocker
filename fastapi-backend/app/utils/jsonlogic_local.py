# app/utils/jsonlogic_local.py
# Minimal JSON Logic evaluator (no external dependency)

def _get(data, key, default=None):
    if not isinstance(data, dict):
        return default
    parts = str(key).split(".")
    cur = data
    for p in parts:
        if isinstance(cur, dict) and p in cur:
            cur = cur[p]
        else:
            return default
    return cur

def jsonLogic(rule, data):
    """Evaluate simple JSON-Logic rule against dict `data`."""
    if not isinstance(rule, dict):
        return rule
    if len(rule) != 1:
        # malformed rule
        return None

    op, vals = next(iter(rule.items()))
    if not isinstance(vals, list):
        vals = [vals]

    # resolve recursively
    ev = lambda x: jsonLogic(x, data) if isinstance(x, dict) else (
        _get(data, x) if isinstance(x, str) else x
    )

    if op == "var":
        return _get(data, vals[0], vals[1] if len(vals) > 1 else None)
    if op == "==":
        return ev(vals[0]) == ev(vals[1])
    if op == "!=":
        return ev(vals[0]) != ev(vals[1])
    if op == ">":
        return ev(vals[0]) > ev(vals[1])
    if op == ">=":
        return ev(vals[0]) >= ev(vals[1])
    if op == "<":
        return ev(vals[0]) < ev(vals[1])
    if op == "<=":
        return ev(vals[0]) <= ev(vals[1])
    if op == "and":
        return all(ev(v) for v in vals)
    if op == "or":
        return any(ev(v) for v in vals)
    if op in ("!", "not"):
        return not ev(vals[0])
    return None
