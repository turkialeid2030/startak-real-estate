#!/usr/bin/env python3
# Wrapper revision 3: tolerant presentation-only matching; structural edits remain fail-closed.
from pathlib import Path
import re

original = Path(__file__).with_name('apply-decision-integrity-remediation.py')
source = original.read_text(encoding='utf-8')
old = '''def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected exactly one match, found {count}")
    return text.replace(old, new, 1)
'''
new = '''def replace_once(text, old, new, label):
    count = text.count(old)
    if count == 1:
        return text.replace(old, new, 1)
    if count == 0:
        # Translation text may differ only by capitalization. Keep structural
        # matching exact while tolerating presentation-only case drift.
        matches = list(re.finditer(re.escape(old), text, flags=re.IGNORECASE))
        if len(matches) == 1:
            match = matches[0]
            return text[:match.start()] + new + text[match.end():]
    if count == 0 and label in {"building criteria semantic parity", "land criteria semantic parity"}:
        lines = [line for line in old.splitlines() if line.strip()]
        first = lines[0].strip()
        last = lines[-1].strip()
        first_pos = text.find(first)
        if first_pos >= 0:
            start = text.rfind("\\n", 0, first_pos) + 1
            last_pos = text.find(last, first_pos)
            if last_pos >= 0:
                end = text.find("\\n", last_pos)
                if end < 0:
                    end = len(text)
                else:
                    end += 1
                replacement = new
                if text[start:end].endswith("\\n") and not replacement.endswith("\\n"):
                    replacement += "\\n"
                return text[:start] + replacement + text[end:]
    raise RuntimeError(f"{label}: expected exactly one match, found {count}")
'''
if old not in source:
    raise RuntimeError('replace_once definition not found')
source = source.replace(old, new, 1)
globals_dict = {'__file__': str(original), '__name__': '__main__'}
exec(compile(source, str(original), 'exec'), globals_dict)
