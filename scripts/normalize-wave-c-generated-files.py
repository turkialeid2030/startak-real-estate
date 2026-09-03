from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

FILES = [
    'src/engines/financial/irr-diagnostics.js',
    'functions/api/riai/_guardrails.mjs',
    'tests/architecture/run_wave_c_remediation_v1.js',
    'tests/architecture/run_riai_ai_gateway_guardrails_unit_v1.js',
    'tests/architecture/run_riai_ai_gateway_integration_v1.js',
    'tests/architecture/run_riai_decision_language_paraphrase_v1.js',
]

for rel in FILES:
    path = ROOT / rel
    text = path.read_text(encoding='utf-8')
    if text.startswith('\\\n'):
        text = text[2:]
    elif text.startswith('\\\r\n'):
        text = text[3:]
    path.write_text(text, encoding='utf-8')

# The documentation block is appended from a raw triple-quoted string as well.
doc = ROOT / 'RIAI_AI_GATEWAY_V1.md'
if doc.exists():
    text = doc.read_text(encoding='utf-8')
    text = text.replace('\n\\\n## Wave C application-level guardrails', '\n\n## Wave C application-level guardrails')
    doc.write_text(text, encoding='utf-8')

print('WAVE_C_GENERATED_FILES_NORMALIZED=PASS')
