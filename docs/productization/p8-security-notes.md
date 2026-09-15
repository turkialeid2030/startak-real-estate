# P8 Security Assumptions

The ADMIN operations runtime assumes that the injected authenticator is a trusted server-side boundary and that its returned verified identity context was produced only after cryptographic token verification and required claim checks.

The runtime independently requires the canonical verified identity shape, applies ADMIN RBAC before loading the workspace, and then verifies that the loaded canonical workspace tenant matches the authenticated tenant.

The operations service intentionally authenticates before delegating to the authenticated workspace service. This can result in two authentication evaluations when the current workspace service also authenticates internally. That duplication is accepted in P8 because it preserves both existing security boundaries rather than weakening either one. A future server composition may share a trusted request identity context only if it preserves equivalent fail-closed verification and does not reintroduce caller-supplied identity authority.

No caller input can promote production, release, merge, deployment, or transaction authority through this runtime.
