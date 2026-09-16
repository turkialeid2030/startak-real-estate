# External RSA-SHA256 Signing Instructions

هذه التعليمات للموقّعين البشريين الخارجيين فقط. المفتاح الخاص لا يدخل GitHub أو CI أو ChatGPT أو أي ملف في المستودع.

## 1. استلام signing request

استخدم الأداة المعتمدة داخل المشروع لإنتاج الطلب. في E2G مثلًا:

```bash
node tools/e2g-release-authority-decision-intake.js decision \
  --policy governance/e2g-human-release-authority-deployment-decision-policy-2026-09-08.json \
  --upstream e2f-final.json \
  --registry release-authority-registry.json \
  --expected-registry-sha <PINNED_REGISTRY_SHA256> \
  --decision unsigned-decision.json \
  --out signing-request.json
```

يجب أن تكون الحالة:

`READY_FOR_EXTERNAL_HUMAN_RSA_SHA256_SIGNATURE`

## 2. استخراج canonical payload

من `signing-request.json` استخدم **بالضبط** قيمة:

`signingPayloadCanonicalUtf8`

لا تعِد ترتيب JSON ولا تبنِ payload جديدًا يدويًا.

احفظ bytes UTF-8 نفسها محليًا في ملف، مثل:

`payload.canonical.txt`

## 3. التوقيع خارج المستودع

مثال OpenSSL على محطة الموقّع/HSM-controlled workstation:

```bash
openssl dgst -sha256 \
  -sign /secure/path/private-key.pem \
  -out signature.bin \
  payload.canonical.txt
```

ثم حوّل التوقيع فقط إلى Base64:

```bash
base64 < signature.bin | tr -d '\n' > signature.base64.txt
```

القيمة الموجودة في `signature.base64.txt` فقط هي التي تعاد كـ`signatureBase64`.

## 4. التحقق المحلي الموصى به

قبل إعادة التوقيع، يمكن للموقّع التحقق محليًا بالمفتاح العام:

```bash
openssl dgst -sha256 \
  -verify public-key.pem \
  -signature signature.bin \
  payload.canonical.txt
```

المتوقع:

`Verified OK`

## 5. ضوابط إلزامية

- لا ترسل private key أو passphrase أو HSM secret.
- لا تضع private key داخل environment variable أو GitHub Secret لهذا الغرض.
- لا توقع نصًا منسوخًا يدويًا إذا اختلف عن `signingPayloadCanonicalUtf8`.
- لا تعيد استخدام توقيع من RC أو packet سابق.
- `decidedAt`/`verifiedAt` يجب أن يقع ضمن فترة صلاحية سجل السلطة/المدقق.
- Merge authority وDeployment authority يجب أن يكونا subjectين مختلفين.
- توقيع صحيح لا يعني وحده أن Merge أو Deploy أصبح مسموحًا؛ verifier النهائي والبوابات الأخرى يجب أن تنجح أيضًا.
