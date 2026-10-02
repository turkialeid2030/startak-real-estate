# C33 — Evidence Request Packets and Outreach Handoff

## Purpose
C33 exists because the 13 real evidence/input items required by C30 and C31 are not currently available to the project owner. C33 does not weaken those requirements. It turns the qualified C32 acquisition map into request-ready packets and an explicit owner-assignment queue.

## Current real state
- request packets structurally ready: 13/13;
- named accountable owners assigned: 0/13;
- requests sent: 0/13;
- responses received: 0/13;
- real C30 evidence supplied/verified: 0/8;
- real C31 canonical gates verified: 0/5.

The current C33 lifecycle therefore remains `REQUEST_PACKETS_READY_OWNER_ASSIGNMENT_REQUIRED`.

## Workflow
1. Identify the real accountable person or organizational contact that performs the role already named in the C32 acquisition map.
2. Record only a real `namedOwnerRef` and `contactRef` in `release/evidence/c33-evidence-outreach-register.json` and change the item to `OWNER_ASSIGNED_READY_TO_SEND`.
3. Generate the request packet using:
   `node tools/c33-evidence-request-pack.js --request "<requestKey>"`
4. A human/operator sends the generated request through an approved communication channel. Only after the real send action is recorded may the lifecycle become `REQUEST_SENT_AWAITING_RESPONSE` with a valid `sentAt` timestamp.
5. When a real response arrives, record the actual receipt and move only to `RESPONSE_RECEIVED_PENDING_GOVERNED_VALIDATION`.
6. The response then enters the existing C30 or C31 governed validator. Receipt alone is never acceptance.

## What C33 refuses to do
- invent a named owner or email address;
- claim a request was sent when no sender action occurred;
- treat the generated packet as evidence;
- treat a response as verified before the existing governed gate evaluates it;
- accept CI, test fixtures, generated documents, copied hashes, preview deployments or engineering self-attestation as substitutes for real evidence;
- grant release, activation, merge, deployment, commercial go-live, transaction, approval or Public-AI authority.

## Packet content
Every packet includes:
- exact request key;
- linked GitHub issue;
- accountable owner role;
- current lifecycle state;
- named-owner/contact status;
- required real deliverable;
- acceptance boundary;
- submission requirements;
- explicit statement that the packet is not evidence and is not an authorization.

## Separation of duties
Engineering may prepare and validate the request mechanism. Engineering cannot self-approve independent security, privacy, legal, source-rights, UAT, historical replay, rollback, AI-provider or canonical-governance evidence when the governing contract requires an independent owner/reviewer.

## Exit condition
C33 engineering is complete when:
- all 13 request records are represented deterministically;
- request packets render without inventing identities;
- invalid lifecycle claims fail closed;
- exact-head CI and canonical Release Verify pass.

C33 completion does not mean the 13 real items have been obtained. Operational collection remains open until real owner assignment, outreach, receipt and governed validation occur.
