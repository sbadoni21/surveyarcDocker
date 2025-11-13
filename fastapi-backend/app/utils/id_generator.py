import secrets
def generate_id():
    return "camp_" + secrets.token_hex(4)