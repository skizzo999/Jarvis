"""Smoke test del classificatore. Non serve pytest per farlo girare:
`python -m tests.test_classify` (dal cwd `/home/matteo/Jarvis/api`).
Esce non-zero se qualche caso fallisce.
"""
import sys

from routers.command_router import classify, parse_actions


CLASSIFY_CASES = [
    # (testo, categoria attesa)
    ("ho speso 50 euro in cena stasera", "task"),         # con numero+no question → task (logga la spesa via add_transaction)
    ("panca piana 60kg 3x10", "task"),
    ("ho mangiato 200g di pasta", "diet"),
    ("mangiato pizza a pranzo", "diet"),
    ("quanto ho speso questa settimana?", "finance"),
    ("che eventi ho domani", "calendar"),
    ("come sto sui macro oggi", "diet"),
    ("quanto peso adesso?", "fitness"),
    ("buongiorno", "general"),
    ("aggiungi 5€ ricarica cash", "task"),
    ("panca 80 oggi", "task"),
]


def test_classify():
    failures = []
    for text, expected in CLASSIFY_CASES:
        got = classify(text)
        if got != expected:
            failures.append((text, expected, got))
    return failures


def test_parse_actions():
    failures = []
    # Caso base: una action valida
    raw = 'ok speso <action>{"type":"add_transaction","params":{"amount":5}}</action>'
    clean, actions = parse_actions(raw)
    if len(actions) != 1 or actions[0]["type"] != "add_transaction":
        failures.append(("single action", 1, len(actions)))
    if "<action>" in clean:
        failures.append(("clean strip", "no tags", clean))
    # JSON invalido: non deve crashare, deve skippare
    raw = 'ok <action>{not json}</action>'
    _, actions = parse_actions(raw)
    if len(actions) != 0:
        failures.append(("bad json", 0, len(actions)))
    return failures


def main():
    cls_fail = test_classify()
    act_fail = test_parse_actions()

    for text, expected, got in cls_fail:
        print(f"FAIL classify: {text!r} → {got} (expected {expected})")
    for case, expected, got in act_fail:
        print(f"FAIL parse_actions ({case}): got {got} (expected {expected})")

    total = len(cls_fail) + len(act_fail)
    if total == 0:
        print(f"OK {len(CLASSIFY_CASES)} classify cases + 3 parse_actions cases")
        return 0
    print(f"FAILURES: {total}")
    return 1


if __name__ == "__main__":
    sys.exit(main())
